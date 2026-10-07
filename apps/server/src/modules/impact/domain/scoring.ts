import type { ImpactCriterion, ImpactCriterionDetail, ImpactLevel } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { maxValueOf } from './methodology';

/** Lower bounds of the levels, from the 40+ and 70+ filters of section 12 (to be confirmed). */
export const MODERATE_FROM = 40;
export const STRONG_FROM = 70;

export function levelOf(score: number): ImpactLevel {
  if (score >= STRONG_FROM) return 'strong';
  if (score >= MODERATE_FROM) return 'moderate';
  return 'emerging';
}

export interface ScoredAssessment {
  score: number;
  level: ImpactLevel;
  details: ImpactCriterionDetail[];
}

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));

/**
 * Every criterion answered with a level of its scale, nothing else; IMPACT_ANSWERS_INVALID
 * otherwise.
 */
export function assertAnswers(
  criteria: readonly ImpactCriterion[],
  answers: Readonly<Record<string, string>>,
): void {
  const keys = Object.keys(answers);
  const complete =
    keys.length === criteria.length &&
    criteria.every((criterion) =>
      criterion.scale.some((level) => level.key === answers[criterion.key]),
    );
  if (!complete) {
    throw new DomainError('IMPACT_ANSWERS_INVALID', 'Every criterion needs one level of its scale');
  }
}

/**
 * Deterministic score from 0 to 100: the weighted mean of the answers, each one relative to the
 * maximum of its scale, rounded half up. Computed on exact fractions (bigint), so that the same
 * answers always give the same score, whatever the order of the criteria.
 */
export function scoreOf(
  criteria: readonly ImpactCriterion[],
  answers: Readonly<Record<string, string>>,
): ScoredAssessment {
  assertAnswers(criteria, answers);
  const details = criteria.map((criterion): ImpactCriterionDetail => {
    const answer = criterion.scale.find((level) => level.key === answers[criterion.key]);
    if (!answer) throw new Error(`Unanswered criterion ${criterion.key}`);
    return {
      criterionKey: criterion.key,
      labelKey: criterion.labelKey,
      descriptionKey: criterion.descriptionKey,
      weight: criterion.weight,
      answerKey: answer.key,
      answerLabelKey: answer.labelKey,
      value: answer.value,
      maxValue: maxValueOf(criterion),
    };
  });
  // Common denominator of the fractions value / max: their least common multiple.
  const denominator = details.reduce((lcm, detail) => {
    const max = BigInt(detail.maxValue);
    return (lcm * max) / gcd(lcm, max);
  }, 1n);
  const weights = details.reduce((sum, detail) => sum + BigInt(detail.weight), 0n);
  const numerator = details.reduce(
    (sum, detail) =>
      sum + BigInt(detail.weight) * BigInt(detail.value) * (denominator / BigInt(detail.maxValue)),
    0n,
  );
  // round(100 * numerator / (weights * denominator)), half up, on integers.
  const total = weights * denominator;
  const score = Number((200n * numerator + total) / (2n * total));
  return { score, level: levelOf(score), details };
}
