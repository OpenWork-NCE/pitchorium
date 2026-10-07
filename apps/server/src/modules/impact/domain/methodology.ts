import type {
  ImpactCriterion,
  ImpactMethodologyStatus,
  ImpactMethodology,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface MethodologyRecord {
  id: string;
  version: number;
  name: string;
  status: ImpactMethodologyStatus;
  demo: boolean;
  criteria: ImpactCriterion[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  archivedAt: Date | null;
}

/** A published or archived version never changes: assessments refer to it (ADR 0036). */
export function assertDraft(methodology: MethodologyRecord): void {
  if (methodology.status !== 'draft') {
    throw new DomainError(
      'IMPACT_METHODOLOGY_NOT_DRAFT',
      `Methodology version ${methodology.version} is ${methodology.status}`,
    );
  }
}

export function assertPublished(methodology: MethodologyRecord): void {
  if (methodology.status !== 'published') {
    throw new DomainError(
      'IMPACT_METHODOLOGY_NOT_PUBLISHED',
      `Methodology version ${methodology.version} is ${methodology.status}`,
    );
  }
}

/** Highest value of the scale of a criterion. */
export function maxValueOf(criterion: ImpactCriterion): number {
  return Math.max(...criterion.scale.map((level) => level.value));
}

export function methodologyView(methodology: MethodologyRecord): ImpactMethodology {
  return {
    id: methodology.id,
    version: methodology.version,
    name: methodology.name,
    status: methodology.status,
    demo: methodology.demo,
    criteria: methodology.criteria,
    createdAt: methodology.createdAt.toISOString(),
    publishedAt: methodology.publishedAt?.toISOString() ?? null,
    archivedAt: methodology.archivedAt?.toISOString() ?? null,
  };
}
