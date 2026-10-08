import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { Clock } from '../../../platform/kernel';
import { repeatEvery } from '../../../platform/queue';
import { GlossaryService } from '../application/glossary.service';
import { LocalizationRepository } from '../application/ports';

export const LOCALIZATION_QUEUE = 'localization.maintenance';
const PURGE = 'purge-translations';

/** Inserts the default glossary at start; purges the expired translations (04:50 UTC). */
@Processor(LOCALIZATION_QUEUE)
export class LocalizationJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(LocalizationJobsProcessor.name);

  constructor(
    @InjectQueue(LOCALIZATION_QUEUE) private readonly queue: Queue,
    private readonly glossary: GlossaryService,
    private readonly localization: LocalizationRepository,
    private readonly clock: Clock,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const inserted = await this.glossary.ensureDefaults();
    if (inserted > 0) this.logger.log(`Inserted ${inserted} default glossary terms`);
    await this.queue.upsertJobScheduler(
      PURGE,
      repeatEvery('50 4 * * *', this.config.scheduledTasks.everyMs),
      { name: PURGE },
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== PURGE) {
      this.logger.warn(`Unknown localization job ${job.name}`);
      return;
    }
    await this.localization.purgeExpired(this.clock.now());
  }
}
