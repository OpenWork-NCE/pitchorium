import { Injectable } from '@nestjs/common';
import type {
  ImpactAssessment,
  ImpactAssessmentSource,
  ImpactSubjectType,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, IdGenerator } from '../../../platform/kernel';
import {
  type AssessmentRecord,
  assertCurrentVersion,
  assessmentView,
  carriedAnswers,
  unavailable,
} from '../domain/assessment';
import { AssessmentSubmitted, AssessmentUpdated } from '../domain/impact-events';
import type { MethodologyRecord } from '../domain/methodology';
import { scoreOf } from '../domain/scoring';
import { ImpactEventsRecorder } from './impact-events.recorder';
import { ImpactRepository } from './ports';

export interface Subject {
  type: ImpactSubjectType;
  id: string;
}

export interface Submission {
  subject: Subject;
  submittedBy: string;
  methodologyId: string;
  answers: Record<string, string>;
  source?: ImpactAssessmentSource;
}

/**
 * Self-declared assessments (section 12). Each submission is kept: the latest one is current,
 * the earlier ones form the history of the subject. Without a published methodology, nothing
 * is assessed and nothing is shown.
 */
@Injectable()
export class AssessmentsService {
  constructor(
    private readonly impact: ImpactRepository,
    private readonly events: ImpactEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async submit(submission: Submission): Promise<ImpactAssessment> {
    const published = assertCurrentVersion(
      await this.impact.publishedMethodology(),
      submission.methodologyId,
    );
    const scored = scoreOf(published.criteria, submission.answers);
    const assessment: AssessmentRecord = {
      id: this.ids.next(),
      subjectType: submission.subject.type,
      subjectId: submission.subject.id,
      methodologyId: published.id,
      answers: submission.answers,
      score: scored.score,
      level: scored.level,
      source: submission.source ?? 'answered',
      submittedBy: submission.submittedBy,
      submittedAt: this.clock.now(),
    };
    await this.transactions.run(async () => {
      const previous = await this.impact.latestAssessment(
        submission.subject.type,
        submission.subject.id,
      );
      await this.impact.insertAssessment(assessment);
      const payload = {
        subjectType: assessment.subjectType,
        subjectId: assessment.subjectId,
        methodologyId: published.id,
        methodologyVersion: published.version,
        score: assessment.score,
        level: assessment.level,
        source: assessment.source,
        submittedBy: assessment.submittedBy,
      };
      if (previous) await this.events.record(AssessmentUpdated, assessment.id, payload);
      else await this.events.record(AssessmentSubmitted, assessment.id, payload);
    });
    return assessmentView(assessment, published, published.id);
  }

  /** Current assessment of a subject; null without one, or without a published methodology. */
  async current(subject: Subject): Promise<ImpactAssessment | null> {
    const published = await this.impact.publishedMethodology();
    if (!published) return null;
    const latest = await this.impact.latestAssessment(subject.type, subject.id);
    if (!latest) return null;
    const methodology =
      latest.methodologyId === published.id
        ? published
        : await this.impact.findMethodology(latest.methodologyId);
    return methodology ? assessmentView(latest, methodology, published.id) : null;
  }

  /** Every assessment of a subject, newest first; IMPACT_METHODOLOGY_UNAVAILABLE without one. */
  async history(subject: Subject): Promise<ImpactAssessment[]> {
    const published = await this.requirePublished();
    const records = await this.impact.assessments(subject.type, subject.id);
    const methodologies = new Map(
      (
        await this.impact.findMethodologies([
          ...new Set(records.map((record) => record.methodologyId)),
        ])
      ).map((methodology) => [methodology.id, methodology]),
    );
    return records.flatMap((record) => {
      const methodology = methodologies.get(record.methodologyId);
      return methodology ? [assessmentView(record, methodology, published.id)] : [];
    });
  }

  /**
   * Answers of `from` that still fit the published version, to prefill the assessment of
   * another subject (a project from the entrepreneur facet of its owner, section 11.1).
   */
  async prefill(
    from: Subject,
  ): Promise<{ methodology: MethodologyRecord; answers: Record<string, string> }> {
    const published = await this.requirePublished();
    const latest = await this.impact.latestAssessment(from.type, from.id);
    return { methodology: published, answers: carriedAnswers(published, latest?.answers ?? {}) };
  }

  async requirePublished(): Promise<MethodologyRecord> {
    const published = await this.impact.publishedMethodology();
    if (!published) throw unavailable();
    return published;
  }
}
