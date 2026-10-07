import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import { InboxService } from '../../../platform/inbox';
import { Clock, IdGenerator } from '../../../platform/kernel';
import type { ProviderId } from '../domain/capability-matrix';
import { ProviderEventReceived } from '../domain/payments-events';
import { PaymentsEventsRecorder } from './payments-events.recorder';
import { PaymentProviders, PaymentsRepository } from './ports';

export type WebhookOutcome = 'accepted' | 'duplicate';

/**
 * Notifications of the providers (api): signature checked on the raw body by the adapter,
 * deduplicated by the inbox, recorded with an internal event in one short transaction, then
 * processed by the worker, which reads the state again from the provider. The answer is fast.
 */
@Injectable()
export class WebhooksService {
  constructor(
    private readonly providers: PaymentProviders,
    private readonly payments: PaymentsRepository,
    private readonly inbox: InboxService,
    private readonly events: PaymentsEventsRecorder,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  isEnabled(provider: string): provider is ProviderId {
    return (this.providers.enabled() as readonly string[]).includes(provider);
  }

  /** Throws WebhookRejectedError on an invalid signature: nothing is recorded. */
  async ingest(
    provider: ProviderId,
    headers: Record<string, string | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookOutcome> {
    const now = this.clock.now();
    const webhook = this.providers.payment(provider).verifyWebhook(headers, rawBody, now);
    let contributionId =
      webhook.contributionId && uuidV7Schema.safeParse(webhook.contributionId).success
        ? webhook.contributionId
        : null;
    if (!contributionId && webhook.providerPaymentId) {
      contributionId =
        (await this.payments.findContributionByPayment(provider, webhook.providerPaymentId))?.id ??
        null;
    }
    const result = await this.inbox.process(`webhook:${provider}`, webhook.externalId, async () => {
      const id = this.ids.next();
      await this.payments.insertProviderEvent({
        id,
        provider,
        externalId: webhook.externalId,
        type: webhook.type,
        contributionId,
        providerAccountId: webhook.providerAccountId,
        receivedAt: now,
      });
      await this.events.record(ProviderEventReceived, id, {
        provider,
        type: webhook.type,
        contributionId,
        providerPaymentId: webhook.providerPaymentId,
        providerAccountId: webhook.providerAccountId,
      });
    });
    return result.status === 'processed' ? 'accepted' : 'duplicate';
  }
}
