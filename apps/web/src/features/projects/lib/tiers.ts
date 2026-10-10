import { PROJECT_LIMITS } from './limits';

/** A tier being written: its cumulative threshold in cents (null while empty) and its use. */
export interface TierDraft {
  thresholdMinor: string | null;
  description: string;
}

export type TierIssue =
  | 'threshold_required'
  | 'threshold_positive'
  | 'not_increasing'
  | 'last_not_goal'
  | 'above_goal'
  | 'description_required'
  | 'description_too_long';

export type TiersIssue = 'too_few' | 'too_many' | 'goal_required';

/**
 * Live check of the tiers of a campaign as the api checks them when they are replaced (ADR 0038,
 * `PUT /v1/projects/{id}/tiers`): 1 to 5 cumulative thresholds, strictly increasing and positive,
 * the last one equal to the goal, each with the use of its funds. The api remains the authority:
 * its refusal is shown the same way.
 */
export function tierIssues(
  tiers: readonly TierDraft[],
  goalMinor: string | null,
): { list: TiersIssue[]; tiers: { index: number; issue: TierIssue }[] } {
  const list: TiersIssue[] = [];
  if (tiers.length < PROJECT_LIMITS.tiersMin) list.push('too_few');
  if (tiers.length > PROJECT_LIMITS.tiersMax) list.push('too_many');
  if (!goalMinor) list.push('goal_required');
  const goal = goalMinor ? BigInt(goalMinor) : null;
  const issues: { index: number; issue: TierIssue }[] = [];
  let previous: bigint | null = null;
  tiers.forEach((tier, index) => {
    const description = tier.description.trim();
    if (!description) issues.push({ index, issue: 'description_required' });
    else if (description.length > PROJECT_LIMITS.tierDescription) {
      issues.push({ index, issue: 'description_too_long' });
    }
    if (tier.thresholdMinor === null || tier.thresholdMinor === '') {
      issues.push({ index, issue: 'threshold_required' });
      return;
    }
    const threshold = BigInt(tier.thresholdMinor);
    if (threshold <= 0n) issues.push({ index, issue: 'threshold_positive' });
    else if (previous !== null && threshold <= previous) {
      issues.push({ index, issue: 'not_increasing' });
    } else if (goal !== null) {
      if (index === tiers.length - 1 && threshold !== goal) {
        issues.push({ index, issue: 'last_not_goal' });
      } else if (index < tiers.length - 1 && threshold >= goal) {
        issues.push({ index, issue: 'above_goal' });
      }
    }
    previous = threshold;
  });
  return { list, tiers: issues };
}
