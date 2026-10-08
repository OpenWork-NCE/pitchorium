import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { DiscoveryKind } from '@pitchorium/contracts';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { EventCanceled, EventCompleted, EventPublished, EventUpdated } from '../../events';
import { MissionClosed, MissionPublished, MissionUpdated } from '../../missions';
import {
  OrganizationCreated,
  OrganizationDeleted,
  OrganizationUpdated,
  VerificationApproved,
  VerificationRevoked,
} from '../../organizations';
import {
  ContributorFacetUpdated,
  EntrepreneurFacetUpdated,
  HandleChanged,
  ProfileCreated,
  ProfileUpdated,
  VisibilityChanged,
} from '../../profiles';
import {
  ProjectClosed,
  ProjectDeleted,
  ProjectFunded,
  ProjectPublished,
  ProjectUpdated,
} from '../../projects';
import { IndexerService } from '../application/indexer.service';
import { DISCOVERY_JOBS, DISCOVERY_QUEUE, type MatchingJob } from './discovery-queue';

/** Source events of the projection, by the kind of entity their aggregate is (ADR 0065). */
const KINDS: Readonly<Record<string, DiscoveryKind>> = {
  [ProfileCreated.TYPE]: 'person',
  [ProfileUpdated.TYPE]: 'person',
  [EntrepreneurFacetUpdated.TYPE]: 'person',
  [ContributorFacetUpdated.TYPE]: 'person',
  [HandleChanged.TYPE]: 'person',
  [VisibilityChanged.TYPE]: 'person',
  [OrganizationCreated.TYPE]: 'organization',
  [OrganizationUpdated.TYPE]: 'organization',
  [OrganizationDeleted.TYPE]: 'organization',
  [VerificationApproved.TYPE]: 'organization',
  [VerificationRevoked.TYPE]: 'organization',
  [ProjectPublished.TYPE]: 'project',
  [ProjectUpdated.TYPE]: 'project',
  [ProjectFunded.TYPE]: 'project',
  [ProjectClosed.TYPE]: 'project',
  [ProjectDeleted.TYPE]: 'project',
  [EventPublished.TYPE]: 'event',
  [EventUpdated.TYPE]: 'event',
  [EventCanceled.TYPE]: 'event',
  [EventCompleted.TYPE]: 'event',
  [MissionPublished.TYPE]: 'mission',
  [MissionUpdated.TYPE]: 'mission',
  [MissionClosed.TYPE]: 'mission',
};

/**
 * Keeps the search projection up to date (worker): the entity is read again through the facade
 * of its module and reindexed in the inbox transaction of the event; the suggestions follow in
 * the matching queue (the subject's lists, and the candidate's row in the lists of others).
 */
@Injectable()
@DomainEventHandler({ name: 'discovery.index', eventTypes: Object.keys(KINDS) })
export class IndexEventsHandler implements DomainEventSubscriber {
  constructor(
    private readonly indexer: IndexerService,
    @InjectQueue(DISCOVERY_QUEUE) private readonly queue: Queue,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const kind = KINDS[event.type];
    if (!kind) return;
    const id = event.aggregateId;
    await this.indexer.reindex(kind, [id]);
    const job: MatchingJob = { kind, id };
    const jobs: string[] = [DISCOVERY_JOBS.candidate];
    if (kind === 'person') jobs.push(DISCOVERY_JOBS.member);
    if (kind === 'project') jobs.push(DISCOVERY_JOBS.project);
    for (const name of jobs) {
      await this.queue.add(name, job, { jobId: `${name}-${event.id}` });
    }
  }
}
