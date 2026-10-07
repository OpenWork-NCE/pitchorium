import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { MediaReady, MediaRejected } from '../../media';
import { VisibilityChanged } from '../../profiles';
import { ContentMaintenanceService } from '../application/content-maintenance.service';
import { PostCreated } from '../domain/content-events';
import { CONTENT_JOBS, CONTENT_QUEUE, type LinkPreviewJobData } from './content-queue';

/** Queues the preview of the link of a new publication; the fetch runs in its own job. */
@Injectable()
@DomainEventHandler({ name: 'content.queue-link-preview', eventTypes: [PostCreated.TYPE] })
export class LinkPreviewHandler implements DomainEventSubscriber {
  constructor(@InjectQueue(CONTENT_QUEUE) private readonly queue: Queue<LinkPreviewJobData>) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    if (event.payload['hasLink'] !== true) return;
    await this.queue.add(
      CONTENT_JOBS.linkPreview,
      { postId: event.aggregateId },
      { jobId: `${CONTENT_JOBS.linkPreview}-${event.aggregateId}`, attempts: 1 },
    );
  }
}

/** Attaches an imported link preview image once ready, or drops it when rejected. */
@Injectable()
@DomainEventHandler({
  name: 'content.link-preview-image',
  eventTypes: [MediaReady.TYPE, MediaRejected.TYPE],
})
export class LinkPreviewImageHandler implements DomainEventSubscriber {
  constructor(private readonly maintenance: ContentMaintenanceService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    if (event.payload['usage'] !== 'link_preview') return;
    if (event.type === MediaReady.TYPE)
      await this.maintenance.attachPreviewImage(event.aggregateId);
    else await this.maintenance.dropPreviewImage(event.aggregateId);
  }
}

/** A member disabled their public page: their public publications become members-only. */
@Injectable()
@DomainEventHandler({ name: 'content.withdraw-public-posts', eventTypes: [VisibilityChanged.TYPE] })
export class PublicPageHandler implements DomainEventSubscriber {
  constructor(private readonly maintenance: ContentMaintenanceService) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    if (event.payload['publicPageEnabled'] !== false) return;
    await this.maintenance.withdrawPublicPosts(event.aggregateId);
  }
}
