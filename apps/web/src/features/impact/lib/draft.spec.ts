import { impactMethodologyDraftSchema } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { AUTHORED_PREFIX, newCriterion, newLevel, withAuthoredKeys } from './draft';

describe('methodology drafts', () => {
  it('starts a criterion the contracts accept, its keys free in the draft', () => {
    const criterion = newCriterion(['criterion_2']);
    expect(criterion.key).toBe('criterion_3');
    const labelled = {
      ...criterion,
      labels: { fr: 'Emplois' },
      descriptions: { fr: 'Emplois créés.' },
      scale: criterion.scale.map((level) => ({ ...level, labels: { fr: level.key } })),
    };
    expect(
      impactMethodologyDraftSchema.safeParse({ name: 'v2', criteria: [labelled] }).success,
    ).toBe(true);
  });

  it('adds a level with a free key and no value', () => {
    const level = newLevel(newCriterion([]));
    expect(level).toMatchObject({ key: 'level_3', value: 0 });
  });

  it('renames the keys of an authored criterion with its key, never those of the catalogue', () => {
    const authored = withAuthoredKeys({ ...newCriterion([]), key: 'jobs' });
    expect(authored.labelKey).toBe(`${AUTHORED_PREFIX}.jobs.label`);
    expect(authored.scale.map((level) => level.labelKey)).toEqual([
      `${AUTHORED_PREFIX}.jobs.none`,
      `${AUTHORED_PREFIX}.jobs.full`,
    ]);
    const catalogue = { ...authored, labelKey: 'impactDemo.criterion01.label', key: 'other' };
    expect(withAuthoredKeys(catalogue)).toBe(catalogue);
  });
});
