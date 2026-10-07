import type { ImpactCriterion } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import { assessmentView, assertCurrentVersion, carriedAnswers } from './assessment';
import { assertDraft, assertPublished, type MethodologyRecord } from './methodology';
import { levelOf, scoreOf } from './scoring';

const scale = (...values: number[]) =>
  values.map((value) => ({ key: `l${value}`, labelKey: `t.l${value}`, value }));

const criterion = (key: string, weight: number, values: number[]): ImpactCriterion => ({
  key,
  labelKey: `t.${key}.label`,
  descriptionKey: `t.${key}.description`,
  weight,
  scale: scale(...values),
});

const CRITERIA = [
  criterion('jobs', 3, [0, 1, 2, 3, 4]),
  criterion('climate', 2, [0, 5, 10]),
  criterion('gender', 1, [0, 1]),
];

const methodology = (overrides: Partial<MethodologyRecord> = {}): MethodologyRecord => ({
  id: 'm-1',
  version: 1,
  name: 'V1',
  status: 'published',
  demo: false,
  criteria: CRITERIA,
  createdBy: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  publishedAt: new Date('2026-10-01T00:00:00Z'),
  archivedAt: null,
  ...overrides,
});

const code = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
  return null;
};

describe('impact score', () => {
  it('is the weighted mean of the answers relative to their scale, from 0 to 100', () => {
    expect(scoreOf(CRITERIA, { jobs: 'l0', climate: 'l0', gender: 'l0' }).score).toBe(0);
    expect(scoreOf(CRITERIA, { jobs: 'l4', climate: 'l10', gender: 'l1' }).score).toBe(100);
    // (3 * 2/4 + 2 * 5/10 + 1 * 1/1) / 6 = 3.5 / 6 = 58.33 %.
    const scored = scoreOf(CRITERIA, { jobs: 'l2', climate: 'l5', gender: 'l1' });
    expect(scored.score).toBe(58);
    expect(scored.level).toBe('moderate');
    expect(scored.details[1]).toMatchObject({
      criterionKey: 'climate',
      answerKey: 'l5',
      answerLabelKey: 't.l5',
      value: 5,
      maxValue: 10,
      weight: 2,
    });
  });

  it('rounds half up on exact fractions, whatever the order of the criteria', () => {
    const halves = [criterion('a', 1, [0, 1, 2, 3, 4, 5, 6, 7, 8]), criterion('b', 1, [0, 1])];
    // (5/8 + 0) / 2 = 31.25 %; (1/8 + 1) / 2 = 56.25 %; (7/8 + 0) / 2 = 43.75 %.
    expect(scoreOf(halves, { a: 'l5', b: 'l0' }).score).toBe(31);
    expect(scoreOf(halves, { a: 'l1', b: 'l1' }).score).toBe(56);
    expect(scoreOf(halves, { a: 'l7', b: 'l0' }).score).toBe(44);
    const answers = { jobs: 'l3', climate: 'l10', gender: 'l0' };
    expect(scoreOf([...CRITERIA].reverse(), answers).score).toBe(scoreOf(CRITERIA, answers).score);
  });

  it('gives the levels from the 40+ and 70+ filters', () => {
    expect([0, 39, 40, 69, 70, 100].map(levelOf)).toEqual([
      'emerging',
      'emerging',
      'moderate',
      'moderate',
      'strong',
      'strong',
    ]);
  });

  it('refuses a missing, unknown or extra answer', () => {
    for (const answers of <Record<string, string>[]>[
      { jobs: 'l1', climate: 'l5' },
      { jobs: 'l1', climate: 'l7', gender: 'l1' },
      { jobs: 'l1', climate: 'l5', gender: 'l1', extra: 'l1' },
    ]) {
      expect(code(() => scoreOf(CRITERIA, answers))).toBe('IMPACT_ANSWERS_INVALID');
    }
  });
});

describe('methodology versions', () => {
  it('only lets a draft change, and only archives the published version', () => {
    expect(code(() => assertDraft(methodology({ status: 'draft' })))).toBeNull();
    expect(code(() => assertDraft(methodology()))).toBe('IMPACT_METHODOLOGY_NOT_DRAFT');
    expect(code(() => assertDraft(methodology({ status: 'archived' })))).toBe(
      'IMPACT_METHODOLOGY_NOT_DRAFT',
    );
    expect(code(() => assertPublished(methodology({ status: 'draft' })))).toBe(
      'IMPACT_METHODOLOGY_NOT_PUBLISHED',
    );
  });

  it('accepts answers for the published version only', () => {
    expect(code(() => assertCurrentVersion(null, 'm-1'))).toBe('IMPACT_METHODOLOGY_UNAVAILABLE');
    expect(code(() => assertCurrentVersion(methodology(), 'm-0'))).toBe(
      'IMPACT_METHODOLOGY_OUTDATED',
    );
    expect(assertCurrentVersion(methodology(), 'm-1').id).toBe('m-1');
  });

  it('keeps old assessments with their version and suggests a reassessment', () => {
    const v1 = methodology();
    const assessment = {
      id: 'a-1',
      subjectType: 'project' as const,
      subjectId: 'p-1',
      methodologyId: 'm-1',
      answers: { jobs: 'l4', climate: 'l10', gender: 'l1' },
      score: 100,
      level: 'strong' as const,
      source: 'answered' as const,
      submittedBy: 'u-1',
      submittedAt: new Date('2026-10-02T00:00:00Z'),
    };
    expect(assessmentView(assessment, v1, 'm-1')).toMatchObject({
      selfDeclared: true,
      methodology: { version: 1 },
      reassessmentSuggested: false,
    });
    expect(assessmentView(assessment, v1, 'm-2').reassessmentSuggested).toBe(true);
  });

  it('carries over the answers that still fit the published version', () => {
    const v2 = methodology({
      id: 'm-2',
      criteria: [criterion('jobs', 1, [0, 1, 2]), criterion('water', 1, [0, 1])],
    });
    expect(carriedAnswers(v2, { jobs: 'l2', climate: 'l5', gender: 'l1' })).toEqual({
      jobs: 'l2',
    });
    expect(carriedAnswers(v2, { jobs: 'l4' })).toEqual({});
  });
});
