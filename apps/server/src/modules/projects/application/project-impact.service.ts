import { Injectable } from '@nestjs/common';
import type { ImpactAssessment, SubmitImpactAssessmentRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ImpactFacade } from '../../impact';
import { ProjectUpdated } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

/**
 * Self-declared impact of a project (sections 11.1 and 12), through the impact module. The
 * current score is copied to the project in the same transaction, for the showcase filters.
 */
@Injectable()
export class ProjectImpactService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly impact: ImpactFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  submit(
    projectId: string,
    userId: string,
    request: SubmitImpactAssessmentRequest,
  ): Promise<ImpactAssessment> {
    return this.transactions.run(async () => {
      const assessment = await this.impact.submit({
        subject: { type: 'project', id: projectId },
        submittedBy: userId,
        methodologyId: request.methodologyId,
        answers: request.answers,
      });
      await this.projects.updateProject(
        projectId,
        {
          impactScore: assessment.score,
          impactLevel: assessment.level,
          impactMethodologyVersion: assessment.methodology.version,
        },
        this.clock.now(),
      );
      await this.events.record(ProjectUpdated, projectId, { fields: ['impactScore'] });
      return assessment;
    });
  }

  history(projectId: string): Promise<ImpactAssessment[]> {
    return this.impact.history({ type: 'project', id: projectId });
  }

  /** Answers of the entrepreneur facet of the owner still valid for the published version. */
  async prefill(
    projectId: string,
  ): Promise<{ methodologyId: string; answers: Record<string, string> }> {
    const project = await this.projects.findProject(projectId);
    const { methodologyId, answers } = await this.impact.prefill({
      type: 'entrepreneur_facet',
      id: project?.ownerId ?? '',
    });
    return { methodologyId, answers };
  }
}
