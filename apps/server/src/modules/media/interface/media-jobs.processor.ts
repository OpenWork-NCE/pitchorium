import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { MediaMaintenanceService } from '../application/media-maintenance.service';
import { MediaProcessingService } from '../application/media-processing.service';
import { MediaVisibilityService } from '../application/media-visibility.service';
import { MEDIA_JOBS, MEDIA_QUEUE, type MoveJobData, type ProcessJobData } from './media-queue';

/**
 * Processing jobs and scheduled tasks of the media module. A processing job retried after a
 * failure is safe: the service skips settled assets.
 */
@Processor(MEDIA_QUEUE, { concurrency: 2 })
export class MediaJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediaJobsProcessor.name);

  constructor(
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue,
    private readonly processing: MediaProcessingService,
    private readonly maintenance: MediaMaintenanceService,
    private readonly visibility: MediaVisibilityService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    await this.queue.upsertJobScheduler(
      MEDIA_JOBS.deleteOrphans,
      repeatEvery('7,37 * * * *', every),
      { name: MEDIA_JOBS.deleteOrphans },
    );
    await this.queue.upsertJobScheduler(
      MEDIA_JOBS.purgeDeleted,
      repeatEvery('*/5 * * * *', every),
      { name: MEDIA_JOBS.purgeDeleted },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MEDIA_JOBS.process: {
        const { mediaId } = job.data as ProcessJobData;
        const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        await this.processing.process(mediaId, lastAttempt);
        return;
      }
      case MEDIA_JOBS.move:
        await this.visibility.move((job.data as MoveJobData).mediaId);
        return;
      case MEDIA_JOBS.deleteOrphans:
        await this.maintenance.deleteOrphans();
        return;
      case MEDIA_JOBS.purgeDeleted:
        await this.maintenance.purgeDeleted();
        return;
      default:
        this.logger.warn(`Unknown media job ${job.name}`);
    }
  }
}
