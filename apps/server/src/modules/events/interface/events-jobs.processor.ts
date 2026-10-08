import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { EventsMaintenanceService } from '../application/events-maintenance.service';
import { EVENTS_JOBS, EVENTS_QUEUE } from './events-queue';

/** Scheduled task: completing the events whose end has passed (every 5 minutes). */
@Processor(EVENTS_QUEUE)
export class EventsJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(EventsJobsProcessor.name);

  constructor(
    @InjectQueue(EVENTS_QUEUE) private readonly queue: Queue,
    private readonly maintenance: EventsMaintenanceService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EVENTS_JOBS.completeEnded,
      repeatEvery('*/5 * * * *', this.config.scheduledTasks.everyMs),
      { name: EVENTS_JOBS.completeEnded },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name === EVENTS_JOBS.completeEnded) {
      await this.maintenance.completeEnded();
      return;
    }
    this.logger.warn(`Unknown events job ${job.name}`);
  }
}
