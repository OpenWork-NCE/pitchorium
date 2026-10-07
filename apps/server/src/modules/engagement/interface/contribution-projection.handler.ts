import { Injectable } from '@nestjs/common';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import {
  ContributionDisputeResolved,
  ContributionRefunded,
  ContributionSucceeded,
} from '../../payments';
import { EngagementService } from '../application/engagement.service';

/**
 * Keeps the projection of the contributions (ADR 0053): each event only names the contribution,
 * whose current state is read through the payments facade, so a replayed or late event gives
 * the same row.
 */
@Injectable()
@DomainEventHandler({
  name: 'engagement.project-contributions',
  eventTypes: [
    ContributionSucceeded.TYPE,
    ContributionRefunded.TYPE,
    ContributionDisputeResolved.TYPE,
  ],
})
export class ContributionProjectionHandler implements DomainEventSubscriber {
  constructor(private readonly engagement: EngagementService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    await this.engagement.project([event.aggregateId]);
  }
}
