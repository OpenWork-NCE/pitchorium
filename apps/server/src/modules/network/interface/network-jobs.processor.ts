import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { NetworkMaintenanceService } from '../application/network-maintenance.service';
import { NETWORK_JOBS, NETWORK_QUEUE } from './network-queue';

/** Scheduled tasks of the network module. */
@Processor(NETWORK_QUEUE)
export class NetworkJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(NetworkJobsProcessor.name);

  constructor(
    @InjectQueue(NETWORK_QUEUE) private readonly queue: Queue,
    private readonly maintenance: NetworkMaintenanceService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    const schedules: [string, string][] = [
      [NETWORK_JOBS.flushProfileViews, '* * * * *'],
      [NETWORK_JOBS.expireRequests, '*/15 * * * *'],
      [NETWORK_JOBS.purgeProfileViews, '23 3 * * *'],
    ];
    for (const [name, pattern] of schedules) {
      await this.queue.upsertJobScheduler(name, repeatEvery(pattern, every), { name });
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NETWORK_JOBS.flushProfileViews:
        await this.maintenance.flushProfileViews();
        return;
      case NETWORK_JOBS.expireRequests:
        await this.maintenance.expireRequests();
        return;
      case NETWORK_JOBS.purgeProfileViews:
        await this.maintenance.purgeProfileViews();
        return;
      default:
        this.logger.warn(`Unknown network job ${job.name}`);
    }
  }
}
