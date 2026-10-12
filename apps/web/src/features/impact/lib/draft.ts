import type {
  ImpactCriterion,
  ImpactMethodology,
  ImpactMethodologyDraft,
} from '@pitchorium/contracts';

/**
 * Keys of the labels of a criterion written in the console (ADR 0173): its texts are stored in
 * the methodology, the key only names them; a criterion of the catalogue keeps its own.
 */
export const AUTHORED_PREFIX = 'impactAuthored';

/** The draft a methodology version starts from: its name and criteria, nothing else. */
export function draftOf(
  methodology: Pick<ImpactMethodology, 'name' | 'criteria'>,
): ImpactMethodologyDraft {
  return {
    name: methodology.name,
    criteria: methodology.criteria.map((criterion) => ({ ...criterion })),
  };
}

/** A new criterion with a two-level scale, its keys free among those of the draft. */
export function newCriterion(existing: readonly string[]): ImpactCriterion {
  let index = existing.length + 1;
  while (existing.includes(`criterion_${index}`)) index += 1;
  const key = `criterion_${index}`;
  return withAuthoredKeys({
    key,
    labelKey: `${AUTHORED_PREFIX}.${key}.label`,
    descriptionKey: `${AUTHORED_PREFIX}.${key}.description`,
    labels: {},
    descriptions: {},
    weight: 1,
    scale: [
      { key: 'none', labelKey: `${AUTHORED_PREFIX}.${key}.none`, labels: {}, value: 0 },
      { key: 'full', labelKey: `${AUTHORED_PREFIX}.${key}.full`, labels: {}, value: 100 },
    ],
  });
}

/** A new level of a scale, its key free among those of the criterion. */
export function newLevel(criterion: ImpactCriterion): ImpactCriterion['scale'][number] {
  let index = criterion.scale.length + 1;
  while (criterion.scale.some((level) => level.key === `level_${index}`)) index += 1;
  const key = `level_${index}`;
  return { key, labelKey: `${AUTHORED_PREFIX}.${criterion.key}.${key}`, labels: {}, value: 0 };
}

/**
 * The keys of an authored criterion follow its key and those of its levels; a criterion of the
 * catalogue (any other prefix) keeps the keys of the catalogue.
 */
export function withAuthoredKeys(criterion: ImpactCriterion): ImpactCriterion {
  if (!criterion.labelKey.startsWith(`${AUTHORED_PREFIX}.`)) return criterion;
  return {
    ...criterion,
    labelKey: `${AUTHORED_PREFIX}.${criterion.key}.label`,
    descriptionKey: `${AUTHORED_PREFIX}.${criterion.key}.description`,
    scale: criterion.scale.map((level) => ({
      ...level,
      labelKey: `${AUTHORED_PREFIX}.${criterion.key}.${level.key}`,
    })),
  };
}
