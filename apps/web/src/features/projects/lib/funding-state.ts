import type { ProjectFunding, ProjectStatus } from '@pitchorium/contracts';

/**
 * Where the campaign of a project stands for its funding block (§11.2), from what the api gives:
 * the status, the days left and the amounts. Nothing is recomputed: a project is open while the
 * api says `funding` or `funded` (the goal may be exceeded until the end date, ADR 0038).
 */
export type FundingTime =
  /** A draft: its duration, counted from the publication. */
  | { kind: 'duration'; days: number | null }
  | { kind: 'daysLeft'; days: number }
  /** The last day of an open campaign (`daysLeft` 0). */
  | { kind: 'lastDay' }
  /** Ended: the end date passed, the tiers reached stay acquired (flexible funding). */
  | { kind: 'ended' };

export interface FundingState {
  /** Contributions may be made (FRONT 5B): open, and not frozen by a moderation decision. */
  open: boolean;
  /** The goal is reached (the collected amount may exceed it). */
  goalReached: boolean;
  /** Status written next to the amounts: the outcome of an ended campaign, its state otherwise. */
  outcome: 'draft' | 'funding' | 'funded' | 'closed_funded' | 'closed';
  time: FundingTime;
  /** Contributions stopped by a moderation decision (§13), whatever the status. */
  frozen: boolean;
}

export function fundingState(
  status: ProjectStatus,
  funding: Pick<ProjectFunding, 'goal' | 'collected' | 'daysLeft'>,
  options: { frozen?: boolean; durationDays?: number | null } = {},
): FundingState {
  const goalReached =
    funding.goal !== null &&
    BigInt(funding.collected.amountMinor) >= BigInt(funding.goal.amountMinor);
  const frozen = options.frozen ?? false;
  if (status === 'draft') {
    return {
      open: false,
      goalReached,
      outcome: 'draft',
      time: { kind: 'duration', days: options.durationDays ?? null },
      frozen,
    };
  }
  if (status === 'closed') {
    return {
      open: false,
      goalReached,
      outcome: goalReached ? 'closed_funded' : 'closed',
      time: { kind: 'ended' },
      frozen,
    };
  }
  const days = funding.daysLeft ?? 0;
  return {
    open: !frozen,
    goalReached,
    outcome: status,
    time: days > 0 ? { kind: 'daysLeft', days } : { kind: 'lastDay' },
    frozen,
  };
}
