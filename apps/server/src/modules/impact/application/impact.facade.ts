import { Injectable } from '@nestjs/common';
import type { ImpactAssessment, ImpactMethodologyRef } from '@pitchorium/contracts';
import { AssessmentsService, type Subject, type Submission } from './assessments.service';
import { ImpactRepository } from './ports';

/** Public facade of the impact module, for the projects module. */
@Injectable()
export class ImpactFacade {
  constructor(
    private readonly impact: ImpactRepository,
    private readonly assessments: AssessmentsService,
  ) {}

  /** The published methodology version, null while none is published. */
  async publishedMethodology(): Promise<ImpactMethodologyRef | null> {
    const published = await this.impact.publishedMethodology();
    return published
      ? {
          id: published.id,
          version: published.version,
          name: published.name,
          demo: published.demo,
        }
      : null;
  }

  /** Joins the transaction of the caller when there is one. */
  submit(submission: Submission): Promise<ImpactAssessment> {
    return this.assessments.submit(submission);
  }

  current(subject: Subject): Promise<ImpactAssessment | null> {
    return this.assessments.current(subject);
  }

  history(subject: Subject): Promise<ImpactAssessment[]> {
    return this.assessments.history(subject);
  }

  /** Answers of `from` still valid under the published version (prefill of a project). */
  async prefill(
    from: Subject,
  ): Promise<{ methodologyId: string; answers: Record<string, string>; complete: boolean }> {
    const { methodology, answers } = await this.assessments.prefill(from);
    return {
      methodologyId: methodology.id,
      answers,
      complete: Object.keys(answers).length === methodology.criteria.length,
    };
  }
}
