import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { MediaRequested, MediaUploaded, MediaVisibilityRequested } from '../domain/media-events';
import { MEDIA_JOBS, MEDIA_QUEUE, type ProcessJobData } from './media-queue';

/**
 * Queues the processing of a confirmed upload or of a requested import, and the moves between
 * buckets. The work itself runs in its own job, outside the inbox transaction of this handler
 * (ADR 0019).
 */
@Injectable()
@DomainEventHandler({
  name: 'media.queue-processing',
  eventTypes: [MediaUploaded.TYPE, MediaRequested.TYPE, MediaVisibilityRequested.TYPE],
})
export class MediaProcessingHandler implements DomainEventSubscriber {
  constructor(@InjectQueue(MEDIA_QUEUE) private readonly queue: Queue<ProcessJobData>) {}

  async handle(event: OutboxEnvelope): Promise<void> {
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
