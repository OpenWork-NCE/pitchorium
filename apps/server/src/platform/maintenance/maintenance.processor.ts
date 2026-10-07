import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { IdempotencyService } from '../idempotency';
import { QUEUE_NAMES } from '../queue';

export const MAINTENANCE_JOBS = {
  purgeIdempotencyKeys: 'purge-idempotency-keys',
} as const;

/** Scheduled technical tasks. Job schedulers are idempotent upserts, safe with several workers. */
@Processor(QUEUE_NAMES.maintenance)
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.maintenance) private readonly queue: Queue,
    private readonly idempotency: IdempotencyService,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      MAINTENANCE_JOBS.purgeIdempotencyKeys,
      { pattern: '17 * * * *' },
      { name: MAINTENANCE_JOBS.purgeIdempotencyKeys },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MAINTENANCE_JOBS.purgeIdempotencyKeys: {
        const purged = await this.idempotency.purgeExpired();
        this.logger.log(`Purged ${purged} expired idempotency keys`);
        return;
      }
      default:
        this.logger.warn(`Unknown maintenance job ${job.name}`);
    }
  }
}
