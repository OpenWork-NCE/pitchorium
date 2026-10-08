import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../config';
import { IdempotencyService } from '../idempotency';
import { InboxService } from '../inbox';
import { Clock } from '../kernel';
import { OutboxService } from '../outbox';
import { QUEUE_NAMES, repeatEvery } from '../queue';

export const MAINTENANCE_JOBS = {
  purgeIdempotencyKeys: 'purge-idempotency-keys',
  purgeOutbox: 'purge-outbox',
} as const;

/** Scheduled technical tasks. Job schedulers are idempotent upserts, safe with several workers. */
@Processor(QUEUE_NAMES.maintenance)
export class MaintenanceProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.maintenance) private readonly queue: Queue,
    private readonly idempotency: IdempotencyService,
    private readonly outbox: OutboxService,
    private readonly inbox: InboxService,
    private readonly clock: Clock,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      MAINTENANCE_JOBS.purgeIdempotencyKeys,
      repeatEvery('17 * * * *', this.config.scheduledTasks.everyMs),
      { name: MAINTENANCE_JOBS.purgeIdempotencyKeys },
    );
    await this.queue.upsertJobScheduler(
      MAINTENANCE_JOBS.purgeOutbox,
      repeatEvery('35 3 * * *', this.config.scheduledTasks.everyMs),
      { name: MAINTENANCE_JOBS.purgeOutbox },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MAINTENANCE_JOBS.purgeIdempotencyKeys: {
        const purged = await this.idempotency.purgeExpired();
        this.logger.log(`Purged ${purged} expired idempotency keys`);
        return;
      }
      case MAINTENANCE_JOBS.purgeOutbox: {
        const before = new Date(this.clock.now().getTime() - this.config.outbox.retentionMs);
        const events = await this.outbox.purgePublished(before);
        const messages = await this.inbox.purgeProcessed(before);
        this.logger.log(`Purged ${events} published events and ${messages} inbox messages`);
        return;
      }
      default:
        this.logger.warn(`Unknown maintenance job ${job.name}`);
    }
  }
}
