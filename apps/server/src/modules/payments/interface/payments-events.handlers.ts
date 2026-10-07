import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { Money } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { ProjectsFacade } from '../../projects';
import { PaymentsRepository } from '../application/ports';
import { ContributionSucceeded, ProviderEventReceived } from '../domain/payments-events';
import { formatUtc, PaymentsMailer } from '../infrastructure/payments-mailer';
import { PAYMENTS_JOBS, PAYMENTS_QUEUE } from './payments-queue';

/**
 * A verified notification of a provider: the worker reads the state again from the provider in
 * its own job, outside the inbox transaction of this handler (ADR 0019).
 */
@Injectable()
@DomainEventHandler({
  name: 'payments.queue-provider-sync',
  eventTypes: [ProviderEventReceived.TYPE],
})
export class ProviderEventsHandler implements DomainEventSubscriber {
  constructor(@InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const { contributionId, providerAccountId, provider, providerPaymentId, paymentReference } =
      event.payload;
    if (typeof contributionId === 'string') {
      await this.queue.add(
        PAYMENTS_JOBS.syncContribution,
        {
          contributionId,
          providerPaymentId: typeof providerPaymentId === 'string' ? providerPaymentId : null,
        },
        { jobId: `${PAYMENTS_JOBS.syncContribution}-${event.id}` },
      );
      return;
    }
    if (typeof paymentReference === 'string' && typeof provider === 'string') {
      await this.queue.add(
        PAYMENTS_JOBS.syncPaymentReference,
        { provider, paymentReference },
        { jobId: `${PAYMENTS_JOBS.syncPaymentReference}-${event.id}` },
      );
      return;
    }
    if (typeof providerAccountId === 'string' && typeof provider === 'string') {
      await this.queue.add(
        PAYMENTS_JOBS.syncPayoutAccount,
        { provider, providerAccountId },
        { jobId: `${PAYMENTS_JOBS.syncPayoutAccount}-${event.id}` },
      );
    }
  }
}

/** Confirmation email to the contributor (section 9.3 step 6), not a tax receipt. */
@Injectable()
@DomainEventHandler({ name: 'payments.send-emails', eventTypes: [ContributionSucceeded.TYPE] })
export class ContributionEmailsHandler implements DomainEventSubscriber {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly projects: ProjectsFacade,
    private readonly identity: IdentityFacade,
    private readonly mailer: PaymentsMailer,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const contribution = await this.payments.findContribution(event.aggregateId);
    if (!contribution?.succeededAt) return;
    const [user, project, reward] = await Promise.all([
      this.identity.findUser(contribution.contributorId),
      this.projects.fundable(contribution.projectId),
      contribution.rewardId ? this.projects.reward(contribution.rewardId) : Promise.resolve(null),
    ]);
    if (!user || !project) return;
    const money = (minor: bigint) =>
      `${Money.of(minor, contribution.currency).toDecimal()} ${contribution.currency}`;
    await this.mailer.sendConfirmation(
      { email: user.email, name: user.name, locale: user.locale },
      {
        project: project.title,
        kind: contribution.kind,
        amount: money(contribution.amountMinor),
        commission: money(contribution.commissionMinor),
        paidAt: formatUtc(contribution.succeededAt),
        ...(reward ? { reward: reward.title } : {}),
        reference: contribution.id,
        projectUrl: this.mailer.projectUrl(project.slug),
      },
    );
  }
}
