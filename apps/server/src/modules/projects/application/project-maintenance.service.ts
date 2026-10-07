import { Inject, Injectable, Logger } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { assertTransition, isOpen } from '../domain/project';
import { ProjectClosed, ProjectEndingSoon } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

const BATCH_SIZE = 200;

/** Scheduled tasks of the projects module (worker). */
@Injectable()
export class ProjectMaintenanceService {
  private readonly logger = new Logger(ProjectMaintenanceService.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    private readonly projects: ProjectRepository,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Closes the campaigns whose end date passed. Flexible funding (ADR 0038): the reached tiers
   * stay acquired, nothing is refunded automatically.
   */
  async closeEnded(): Promise<number> {
    const now = this.clock.now();
    let closed = 0;
    for (const id of await this.projects.endedOpenProjectIds(now, BATCH_SIZE)) {
      await this.transactions.run(async () => {
        const project = await this.projects.lockProject(id);
        if (!project || !isOpen(project) || !project.endsAt || project.endsAt > now) return;
        assertTransition(project.status, 'closed');
        await this.projects.updateProject(id, { status: 'closed', closedAt: now }, now);
        await this.events.record(ProjectClosed, id, {
          collectedMinor: String(project.collectedMinor),
          goalMinor: String(project.goalMinor ?? 0n),
          currency: project.currency,
          goalReached: project.goalMinor !== null && project.collectedMinor >= project.goalMinor,
        });
        closed += 1;
      });
    }
    if (closed > 0) this.logger.log(`Closed ${closed} ended projects`);
    return closed;
  }

  /** Announces once the campaigns ending within PROJECTS_ENDING_SOON_HOURS. */
  async announceEndingSoon(): Promise<number> {
    const now = this.clock.now();
    const before = new Date(now.getTime() + this.config.projects.endingSoonMs);
    let announced = 0;
    for (const id of await this.projects.endingSoonProjectIds(before, BATCH_SIZE)) {
      await this.transactions.run(async () => {
        const project = await this.projects.lockProject(id);
        if (!project || !isOpen(project) || project.endingSoonAt || !project.endsAt) return;
        await this.projects.updateProject(id, { endingSoonAt: now }, now);
        await this.events.record(ProjectEndingSoon, id, { endsAt: project.endsAt.toISOString() });
        announced += 1;
      });
    }
    return announced;
  }
}
