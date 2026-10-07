import type { ImpactMethodologyDraft, ImpactSubjectType } from '@pitchorium/contracts';
import type { AssessmentRecord } from '../domain/assessment';
import type { MethodologyRecord } from '../domain/methodology';

export abstract class ImpactRepository {
  abstract findMethodology(id: string): Promise<MethodologyRecord | null>;
  abstract findMethodologies(ids: readonly string[]): Promise<MethodologyRecord[]>;
  abstract publishedMethodology(): Promise<MethodologyRecord | null>;
  abstract listMethodologies(): Promise<MethodologyRecord[]>;
  abstract findDemoMethodology(): Promise<MethodologyRecord | null>;
  abstract nextVersion(): Promise<number>;
  abstract insertMethodology(methodology: MethodologyRecord): Promise<void>;
  abstract updateDraft(id: string, draft: ImpactMethodologyDraft, now: Date): Promise<void>;
  abstract setStatus(id: string, status: MethodologyRecord['status'], now: Date): Promise<void>;
  abstract deleteDraft(id: string): Promise<boolean>;
  /** Serializes the writes of methodology versions (transaction-scoped advisory lock). */
  abstract lockMethodologies(): Promise<void>;
  abstract insertAssessment(assessment: AssessmentRecord): Promise<void>;
  abstract latestAssessment(
    subjectType: ImpactSubjectType,
    subjectId: string,
  ): Promise<AssessmentRecord | null>;
  /** Newest first. */
  abstract assessments(
    subjectType: ImpactSubjectType,
    subjectId: string,
  ): Promise<AssessmentRecord[]>;
}
