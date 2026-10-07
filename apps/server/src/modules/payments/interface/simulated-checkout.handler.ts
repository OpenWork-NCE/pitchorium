import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { RawHttpHandler, type RawHttpRequestHandler } from '../../../platform/http';
import { PaymentProviders } from '../application/ports';
import { WebhooksService } from '../application/webhooks.service';
import { ConfiguredPaymentProviders } from '../infrastructure/payment-providers';
import {
  SIMULATED_SCENARIOS,
  type SimulatedScenario,
} from '../infrastructure/simulated/simulated.provider';

export const SIMULATED_PATH = '/v1/payments/simulated';

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * Hosted page of the simulated provider (development only, ADR 0052): `GET checkout/{session}`
 * shows the amount and one button per scenario; `POST checkout/{session}/{scenario}` plays it
 * and delivers its signed notification to the webhook ingestion, as the provider would. Answers
 * 404 unless PAYMENTS_MODE=simulated (refused in production).
 */
@Injectable()
@RawHttpHandler({ path: SIMULATED_PATH })
export class SimulatedCheckoutHandler implements RawHttpRequestHandler {
  constructor(
    private readonly providers: PaymentProviders,
    private readonly webhooks: WebhooksService,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const simulated =
      this.providers instanceof ConfiguredPaymentProviders ? this.providers.simulated : null;
    const [path, query] = (request.url ?? '').split('?');
    const match = /^\/checkout\/([A-Za-z0-9_-]+)(?:\/([a-z-]+))?\/?$/.exec(path ?? '');
    if (!simulated || this.config.env === 'production' || !match?.[1]) {
      response.statusCode = 404;
      response.end();
      return;
    }
    const sessionId = match[1];
    const session = await simulated.session(sessionId);
    if (!session) {
      response.statusCode = 404;
      response.end();
      return;
    }
    const scenario = match[2];
    if (request.method === 'POST' && scenario) {
      if (!(SIMULATED_SCENARIOS as readonly string[]).includes(scenario)) {
        response.statusCode = 404;
        response.end();
        return;
      }
      const amount = new URLSearchParams(query ?? '').get('amountMinor');
      const webhook = await simulated.play(
        sessionId,
        scenario as SimulatedScenario,
        amount && /^[1-9]\d*$/.test(amount) ? BigInt(amount) : undefined,
      );
      await this.webhooks.ingest('simulated', webhook.headers, Buffer.from(webhook.body));
      const back = `${this.config.webAppUrl}/contributions/${session.reference}/return`;
      this.html(
        response,
        `<p>Scénario simulé : <strong>${escape(scenario)}</strong>. La notification signée a été envoyée.</p><p><a href="${escape(back)}">Retour au site</a></p>`,
      );
      return;
    }
    const buttons = SIMULATED_SCENARIOS.map(
      (name) =>
        `<form method="post" action="${SIMULATED_PATH}/checkout/${escape(sessionId)}/${name}"><button type="submit">${name}</button></form>`,
    ).join('');
    this.html(
      response,
      `<h1>Prestataire simulé</h1><p>Paiement de ${escape(session.amountMinor.toString())} (unités mineures) ${escape(session.currency)}, statut ${escape(session.status)}.</p>${buttons}`,
    );
  }

  private html(response: ServerResponse, body: string): void {
    response.statusCode = 200;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(
      `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Paiement simulé</title><body>${body}</body></html>`,
    );
  }
}
