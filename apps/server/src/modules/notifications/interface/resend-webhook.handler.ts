import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ErrorCode } from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import {
  BodyTooLargeError,
  problemFromCode,
  RawHttpHandler,
  type RawHttpRequestHandler,
  readRawBody,
  resolveRequestId,
} from '../../../platform/http';
import { Clock } from '../../../platform/kernel';
import { ErrorReporter, Metrics } from '../../../platform/observability';
import { DeliverabilityService } from '../application/deliverability.service';
import { verifySvix } from '../infrastructure/svix-signature';

export const RESEND_WEBHOOK_PATH = '/v1/notifications/webhooks/resend';
const WEBHOOK_FAILED_METRIC = 'pitchorium.notifications.webhook.failed';
const KIND_METRICS = {
  bounce: 'pitchorium.notifications.email.bounced',
  complaint: 'pitchorium.notifications.email.complained',
} as const;

function send(response: ServerResponse, status: number, body: unknown, type: string): void {
  response.statusCode = status;
  response.setHeader('content-type', type);
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function problem(response: ServerResponse, code: ErrorCode, requestId: string): void {
  const body = { ...problemFromCode(code), requestId };
  send(response, body.status, body, 'application/problem+json');
}

interface ResendEvent {
  type?: unknown;
  data?: { to?: unknown; bounce?: { type?: unknown } };
}

/**
 * `POST /v1/notifications/webhooks/resend` (ADR 0062): bounces and complaints, signed by Svix
 * with RESEND_WEBHOOK_SECRET, read on the raw body before the body parsers. A permanent bounce
 * or a complaint suppresses the address; other events are acknowledged and ignored. Without
 * the secret, every call is refused. Not part of the OpenAPI document.
 */
@Injectable()
@RawHttpHandler({ path: RESEND_WEBHOOK_PATH })
export class ResendWebhookHandler implements RawHttpRequestHandler {
  private readonly logger = new Logger(ResendWebhookHandler.name);

  constructor(
    private readonly deliverability: DeliverabilityService,
    private readonly errorReporter: ErrorReporter,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = resolveRequestId(request, response);
    const secret = this.config.notifications.resendWebhookSecret;
    if (request.method !== 'POST' || (request.url ?? '/').split('?')[0] !== '/') {
      problem(response, 'NOT_FOUND', requestId);
      return;
    }
    let body: Buffer;
    try {
      body = await readRawBody(request);
    } catch (error) {
      problem(
        response,
        error instanceof BodyTooLargeError ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        requestId,
      );
      return;
    }
    const headers: Record<string, string | undefined> = {};
    for (const [name, value] of Object.entries(request.headers)) {
      headers[name.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
    const verified = secret ? verifySvix(secret, headers, body, this.clock.now()) : null;
    let event: ResendEvent;
    try {
      event = JSON.parse(body.toString('utf8')) as ResendEvent;
    } catch {
      event = {};
    }
    if (!verified || typeof event.type !== 'string') {
      this.logger.warn('Rejected a Resend webhook: missing secret, signature or type');
      this.metrics.increment(WEBHOOK_FAILED_METRIC, { reason: 'rejected' });
      problem(response, 'NOTIFICATIONS_WEBHOOK_INVALID', requestId);
      return;
    }
    const to = event.data?.to;
    const recipients = Array.isArray(to)
      ? to.filter((value): value is string => typeof value === 'string')
      : typeof to === 'string'
        ? [to]
        : [];
    // A transient bounce (full mailbox, greylisting) does not suppress the address.
    const permanentBounce =
      event.type === 'email.bounced' && event.data?.bounce?.type !== 'Transient';
    const kind = permanentBounce
      ? 'bounce'
      : event.type === 'email.complained'
        ? 'complaint'
        : null;
    try {
      const outcome = kind
        ? await this.deliverability.report({ providerEventId: verified.id, kind, recipients })
        : 'ignored';
      if (kind && outcome === 'accepted') this.metrics.add(KIND_METRICS[kind], recipients.length);
      send(response, 200, { received: true, outcome }, 'application/json');
    } catch (error) {
      this.errorReporter.capture(error);
      this.metrics.increment(WEBHOOK_FAILED_METRIC, { reason: 'error' });
      this.logger.error(`Could not record a Resend webhook: ${String(error)}`);
      problem(response, 'INTERNAL_ERROR', requestId);
    }
  }
}
