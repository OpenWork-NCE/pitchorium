import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import {
  MediaCdnPurgeRequested,
  MediaRequested,
  MediaUploaded,
  MediaVisibilityRequested,
} from '../domain/media-events';
import { MEDIA_JOBS, MEDIA_QUEUE, type ProcessJobData, type PurgeCdnJobData } from './media-queue';

/**
 * Queues the processing of a confirmed upload or of a requested import, the moves between
 * buckets and the CDN purges. The work itself runs in its own job, outside the inbox transaction of this handler
 * (ADR 0019).
 */
@Injectable()
@DomainEventHandler({
  name: 'media.queue-processing',
  eventTypes: [
    MediaUploaded.TYPE,
    MediaRequested.TYPE,
    MediaVisibilityRequested.TYPE,
    MediaCdnPurgeRequested.TYPE,
  ],
})
export class MediaProcessingHandler implements DomainEventSubscriber {
  constructor(
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue<ProcessJobData | PurgeCdnJobData>,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    if (event.type === MediaCdnPurgeRequested.TYPE) {
      // Retried with the default backoff of the queue until the CDN accepts the purge.
      const keys = event.payload['keys'] as string[];
      await this.queue.add(
        MEDIA_JOBS.purgeCdn,
        { mediaId: event.aggregateId, keys },
        { jobId: `${MEDIA_JOBS.purgeCdn}-${event.id}` },
      );
      return;
    }
    if (event.type === MediaVisibilityRequested.TYPE) {
      // One job per request: the job checks the current target, so stale requests do nothing.
      await this.queue.add(
        MEDIA_JOBS.move,
        { mediaId: event.aggregateId },
        { jobId: `${MEDIA_JOBS.move}-${event.id}` },
      );
      return;
    }
    if (event.type === MediaRequested.TYPE && event.payload['source'] !== 'import') return;
    // One job per asset: the job id deduplicates a redelivered event.
    await this.queue.add(
      MEDIA_JOBS.process,
      { mediaId: event.aggregateId },
      { jobId: `${MEDIA_JOBS.process}-${event.aggregateId}` },
    );
  }
}
