import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { ContentMaintenanceService } from '../application/content-maintenance.service';
import {
  CONTENT_JOBS,
  CONTENT_QUEUE,
  type LinkPreviewDraftJobData,
  type LinkPreviewJobData,
} from './content-queue';

/** Link previews and scheduled tasks of the content module. */
@Processor(CONTENT_QUEUE, { concurrency: 4 })
export class ContentJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContentJobsProcessor.name);

  constructor(
    @InjectQueue(CONTENT_QUEUE) private readonly queue: Queue,
    private readonly maintenance: ContentMaintenanceService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CONTENT_JOBS.consolidateViews,
      repeatEvery('*/10 * * * *', this.config.scheduledTasks.everyMs),
      { name: CONTENT_JOBS.consolidateViews },
    );
    await this.queue.upsertJobScheduler(
      CONTENT_JOBS.purgeLinkPreviews,
      repeatEvery('17 * * * *', this.config.scheduledTasks.everyMs),
      { name: CONTENT_JOBS.purgeLinkPreviews },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case CONTENT_JOBS.linkPreview:
        await this.maintenance.buildLinkPreview((job.data as LinkPreviewJobData).postId);
        return;
      case CONTENT_JOBS.linkPreviewDraft:
        await this.maintenance.buildDraftLinkPreview(
          (job.data as LinkPreviewDraftJobData).previewId,
        );
        return;
      case CONTENT_JOBS.purgeLinkPreviews:
        await this.maintenance.purgeLinkPreviews();
        return;
      case CONTENT_JOBS.consolidateViews:
        await this.maintenance.consolidateViews();
        return;
      default:
        this.logger.warn(`Unknown content job ${job.name}`);
    }
  }
}
