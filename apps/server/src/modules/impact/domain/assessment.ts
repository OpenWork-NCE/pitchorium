import type {
  ImpactAssessment,
  ImpactAssessmentSource,
  ImpactLevel,
  ImpactSubjectType,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import type { MethodologyRecord } from './methodology';
import { scoreOf } from './scoring';

export interface AssessmentRecord {
  id: string;
  subjectType: ImpactSubjectType;
  subjectId: string;
  methodologyId: string;
  answers: Record<string, string>;
  score: number;
  level: ImpactLevel;
  source: ImpactAssessmentSource;
  submittedBy: string;
  submittedAt: Date;
}

/** Answers must be given for the version published now, not for a replaced one. */
export function assertCurrentVersion(
  published: MethodologyRecord | null,
  methodologyId: string,
): MethodologyRecord {
  if (!published) throw unavailable();
  if (published.id !== methodologyId) {
    throw new DomainError(
      'IMPACT_METHODOLOGY_OUTDATED',
      'The answers were given for another methodology version',
    );
  }
  return published;
}

export function unavailable(): DomainError {
  return new DomainError('IMPACT_METHODOLOGY_UNAVAILABLE', 'No impact methodology is published');
}

/**
 * The answers of another assessment that still fit the published version: same criterion and
 * same level key. The others are left for the member to answer.
 */
export function carriedAnswers(
  published: MethodologyRecord,
  answers: Readonly<Record<string, string>>,
): Record<string, string> {
  return Object.fromEntries(
    published.criteria.flatMap((criterion) => {
      const answer = answers[criterion.key];
      return answer && criterion.scale.some((level) => level.key === answer)
        ? [[criterion.key, answer]]
        : [];
    }),
  );
}

/**
 * The view of an assessment, always marked self-declared, with the version of its methodology
 * and the detail of each criterion (section 12). A reassessment is suggested when another
 * version is published.
 */
export function assessmentView(
  assessment: AssessmentRecord,
  methodology: MethodologyRecord,
  publishedId: string | null,
): ImpactAssessment {
  return {
    id: assessment.id,
    subjectType: assessment.subjectType,
    selfDeclared: true,
    methodology: {
      id: methodology.id,
      version: methodology.version,
      name: methodology.name,
      demo: methodology.demo,
    },
    score: assessment.score,
    level: assessment.level,
    details: scoreOf(methodology.criteria, assessment.answers).details,
    source: assessment.source,
    reassessmentSuggested: publishedId !== null && publishedId !== methodology.id,
    submittedAt: assessment.submittedAt.toISOString(),
  };
}
