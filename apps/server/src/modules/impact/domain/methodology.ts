import type {
  ImpactCriterion,
  ImpactMethodologyStatus,
  ImpactMethodology,
  ImpactMissingLabel,
  Locale,
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

/** Whether the `reference` catalogue of a language holds a key (the labels of the demo). */
export type CatalogLabel = (locale: Locale, key: string) => boolean;

/**
 * The labels the active languages still lack (ADR 0173): for each criterion its label and its
 * description, for each level its label, stored in the version or present in the catalogue.
 */
export function missingLabels(
  criteria: readonly ImpactCriterion[],
  locales: readonly Locale[],
  catalog: CatalogLabel,
): ImpactMissingLabel[] {
  const missing: ImpactMissingLabel[] = [];
  for (const locale of locales) {
    for (const criterion of criteria) {
      if (!criterion.labels?.[locale] && !catalog(locale, criterion.labelKey)) {
        missing.push({ criterionKey: criterion.key, levelKey: null, field: 'label', locale });
      }
      if (!criterion.descriptions?.[locale] && !catalog(locale, criterion.descriptionKey)) {
        missing.push({ criterionKey: criterion.key, levelKey: null, field: 'description', locale });
      }
      for (const level of criterion.scale) {
        if (!level.labels?.[locale] && !catalog(locale, level.labelKey)) {
          missing.push({
            criterionKey: criterion.key,
            levelKey: level.key,
            field: 'label',
            locale,
          });
        }
      }
    }
  }
  return missing;
}

export function assertLabelled(missing: readonly ImpactMissingLabel[]): void {
  if (missing.length > 0) {
    throw new DomainError('IMPACT_LABELS_MISSING', 'Labels missing in an active language', {
      missing: [...new Set(missing.map((label) => label.locale))],
    });
  }
}
