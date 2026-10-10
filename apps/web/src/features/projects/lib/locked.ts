import type { ProjectStatus } from '@pitchorium/contracts';

/** Why an amount of a published campaign can no longer change. */
export type LockReason = 'contribution' | 'published';

export interface LockedFields {
  goal: LockReason | null;
  tierThresholds: LockReason | null;
  rewardMinimums: LockReason | null;
  duration: LockReason | null;
}

/**
 * Fields of a campaign the api refuses to change (ADR 0039): after the first paid contribution,
 * the goal, the thresholds of the tiers and the minimums of the rewards (`fundingLocked` of the
 * management data); after the publication, the duration (no extension, ADR 0038). The texts stay
 * editable.
 */
export function lockedFields(status: ProjectStatus, fundingLocked: boolean): LockedFields {
  const amounts = fundingLocked ? 'contribution' : null;
  return {
    goal: amounts,
    tierThresholds: amounts,
    rewardMinimums: amounts,
    duration: status === 'draft' ? null : 'published',
  };
}
