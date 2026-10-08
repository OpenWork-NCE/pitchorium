import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { ConversationCreated } from '../../messaging';
import { ConnectionRequested } from '../../network';
import { SignalsService } from '../application/signals.service';
import { ProjectRefundsRequested, ReportCreated, ReportResolved } from '../domain/trust-events';
import { type NoticeJob, type RefundJob, TRUST_JOBS, TRUST_QUEUE } from './trust-queue';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Activity of the automatic signals: first messages out of network (conversation requests) and
 * connection requests, counted per sender.
 */
@Injectable()
@DomainEventHandler({
  name: 'trust.signals',
  eventTypes: [ConversationCreated.TYPE, ConnectionRequested.TYPE],
})
export class SignalsHandler implements DomainEventSubscriber {
  constructor(private readonly signals: SignalsService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const payload = event.payload;
    const occurredAt = new Date(event.occurredAt);
    if (event.type === ConversationCreated.TYPE) {
      if (payload['status'] !== 'request') return;
      await this.signals.activity(
        'message_requests',
        text(payload['createdBy']),
        event.id,
        occurredAt,
      );
      return;
    }
    await this.signals.activity(
      'connection_requests',
      text(payload['requesterId']),
      event.id,
      occurredAt,
    );
  }
}

/**
 * Jobs of the trust module born from its events: emails to a notifier without an account,
 * refunds of the contributions of a frozen project (one job per contribution).
 */
@Injectable()
@DomainEventHandler({
  name: 'trust.jobs',
  eventTypes: [ReportCreated.TYPE, ReportResolved.TYPE, ProjectRefundsRequested.TYPE],
})
export class TrustJobsHandler implements DomainEventSubscriber {
  constructor(@InjectQueue(TRUST_QUEUE) private readonly queue: Queue) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const payload = event.payload;
    if (event.type === ProjectRefundsRequested.TYPE) {
      const ids = Array.isArray(payload['contributionIds']) ? payload['contributionIds'] : [];
      for (const contributionId of ids.map(text)) {
        const job: RefundJob = { contributionId, reason: text(payload['reason']) };
        await this.queue.add(TRUST_JOBS.refund, job, {
          jobId: `${TRUST_JOBS.refund}-${event.id}-${contributionId}`,
        });
      }
      return;
    }
    // A member is told by the notifications module.
    if (payload['reporterId'] !== null) return;
    const job: NoticeJob = {
      reportId: event.aggregateId,
      kind: event.type === ReportCreated.TYPE ? 'received' : 'resolved',
    };
    await this.queue.add(TRUST_JOBS.notice, job, { jobId: `${TRUST_JOBS.notice}-${event.id}` });
  }
}
