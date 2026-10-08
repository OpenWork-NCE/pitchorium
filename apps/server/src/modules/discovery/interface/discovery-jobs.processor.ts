import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { IndexMaintenanceService } from '../application/index-maintenance.service';
import { MatchingService } from '../application/matching.service';
import { DISCOVERY_JOBS, DISCOVERY_QUEUE, type MatchingJob } from './discovery-queue';

/** Suggestions after a change, and the daily drift check of the projection (03:50 UTC). */
@Processor(DISCOVERY_QUEUE, { concurrency: 4 })
export class DiscoveryJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(DiscoveryJobsProcessor.name);

  constructor(
    @InjectQueue(DISCOVERY_QUEUE) private readonly queue: Queue,
    private readonly matching: MatchingService,
    private readonly maintenance: IndexMaintenanceService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      DISCOVERY_JOBS.checkDrift,
      repeatEvery('50 3 * * *', this.config.scheduledTasks.everyMs),
      { name: DISCOVERY_JOBS.checkDrift },
    );
  }

  async process(job: Job): Promise<void> {
    const data = job.data as MatchingJob;
    switch (job.name) {
      case DISCOVERY_JOBS.member:
        await this.matching.recomputeMember(data.id);
        return;
      case DISCOVERY_JOBS.project:
        await this.matching.recomputeProject(data.id);
        return;
      case DISCOVERY_JOBS.candidate:
        await this.matching.candidateChanged(data.kind, data.id);
        return;
      case DISCOVERY_JOBS.checkDrift:
        await this.maintenance.checkDrift();
        return;
      default:
        this.logger.warn(`Unknown discovery job ${job.name}`);
    }
  }
}
