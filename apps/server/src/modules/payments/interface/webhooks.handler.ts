import type { IncomingMessage, ServerResponse } from 'node:http';
import { Injectable, Logger } from '@nestjs/common';
import type { ErrorCode } from '@pitchorium/contracts';
import {
  BodyTooLargeError,
  problemFromCode,
  RawHttpHandler,
  type RawHttpRequestHandler,
  readRawBody,
  resolveRequestId,
} from '../../../platform/http';
import { ErrorReporter, Metrics } from '../../../platform/observability';
import { WebhookRejectedError } from '../application/ports';
import { WebhooksService } from '../application/webhooks.service';

export const WEBHOOKS_PATH = '/v1/payments/webhooks';
const WEBHOOK_FAILED_METRIC = 'pitchorium.payments.webhook.failed';

function send(
  response: ServerResponse,
  status: number,
  body: unknown,
  type = 'application/json',
): void {
  response.statusCode = status;
  response.setHeader('content-type', type);
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function problem(
  response: ServerResponse,
  code: ErrorCode,
  requestId: string,
  detail?: string,
): void {
  const body = { ...problemFromCode(code, detail ? { detail } : {}), requestId };
  send(response, body.status, body, 'application/problem+json');
}

/**
 * `POST /v1/payments/webhooks/{stripe|flutterwave|simulated}`, outside Nest routing and before
 * the body parsers (raw body), without session nor origin check: the signature authenticates
 * the provider. Answers 200 once the notification is recorded (the worker processes it), 400
 * on an invalid signature, 5xx when it could not be recorded, so that the provider retries.
 * Not part of the OpenAPI document nor of the generated client.
 */
@Injectable()
@RawHttpHandler({ path: WEBHOOKS_PATH })
export class WebhooksHttpHandler implements RawHttpRequestHandler {
  private readonly logger = new Logger(WebhooksHttpHandler.name);

  constructor(
    private readonly webhooks: WebhooksService,
    private readonly errorReporter: ErrorReporter,
    private readonly metrics: Metrics,
  ) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const requestId = resolveRequestId(request, response);
    const provider = (request.url ?? '').split('?')[0]?.replace(/^\/+|\/+$/g, '') ?? '';
    if (request.method !== 'POST' || !this.webhooks.isEnabled(provider)) {
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
    try {
      const outcome = await this.webhooks.ingest(provider, headers, body);
      send(response, 200, { received: true, duplicate: outcome === 'duplicate' });
    } catch (error) {
      if (error instanceof WebhookRejectedError) {
        this.logger.warn(`Rejected ${provider} webhook: ${error.message}`);
        this.metrics.increment(WEBHOOK_FAILED_METRIC, { provider, reason: 'rejected' });
        problem(response, 'PAYMENTS_WEBHOOK_INVALID', requestId);
        return;
      }
      this.errorReporter.capture(error);
      this.metrics.increment(WEBHOOK_FAILED_METRIC, { provider, reason: 'error' });
      this.logger.error(`Could not record a ${provider} webhook: ${String(error)}`);
      problem(response, 'INTERNAL_ERROR', requestId);
    }
  }
}
