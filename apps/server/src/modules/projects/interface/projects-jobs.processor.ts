import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { ProjectMaintenanceService } from '../application/project-maintenance.service';
import { PROJECTS_JOBS, PROJECTS_QUEUE } from './projects-queue';

/** Scheduled tasks: closing the ended campaigns, announcing those ending soon. */
@Processor(PROJECTS_QUEUE)
export class ProjectsJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProjectsJobsProcessor.name);

  constructor(
    @InjectQueue(PROJECTS_QUEUE) private readonly queue: Queue,
    private readonly maintenance: ProjectMaintenanceService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    await this.queue.upsertJobScheduler(
      PROJECTS_JOBS.closeEnded,
      repeatEvery('*/5 * * * *', every),
      { name: PROJECTS_JOBS.closeEnded },
    );
    await this.queue.upsertJobScheduler(
      PROJECTS_JOBS.announceEndingSoon,
      repeatEvery('17 * * * *', every),
      { name: PROJECTS_JOBS.announceEndingSoon },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PROJECTS_JOBS.closeEnded:
        await this.maintenance.closeEnded();
        return;
      case PROJECTS_JOBS.announceEndingSoon:
        await this.maintenance.announceEndingSoon();
        return;
      default:
        this.logger.warn(`Unknown projects job ${job.name}`);
    }
  }
}
