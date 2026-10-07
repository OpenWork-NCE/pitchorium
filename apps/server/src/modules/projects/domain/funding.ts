import { PROJECT_TIERS_MAX, PROJECT_TIERS_MIN, type ProjectStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface TierRecord {
  id: string;
  projectId: string;
  position: number;
  thresholdMinor: bigint;
  description: string;
  unlockedAt: Date | null;
}

export interface TierInput {
  thresholdMinor: bigint;
  description: string;
}

/**
 * 1 to 5 tiers with cumulative thresholds, strictly increasing and positive (ADR 0038). The
 * last threshold is the goal of the project: replacing the tiers sets the goal.
 */
export function assertTiers(tiers: readonly TierInput[]): void {
  const valid =
    tiers.length >= PROJECT_TIERS_MIN &&
    tiers.length <= PROJECT_TIERS_MAX &&
    tiers.every(
      (tier, index) =>
        tier.thresholdMinor > 0n &&
        (index === 0 || tier.thresholdMinor > (tiers[index - 1]?.thresholdMinor ?? 0n)),
    );
  if (!valid) {
    throw new DomainError(
      'PROJECTS_TIERS_INVALID',
      'Tier thresholds must be positive and strictly increasing',
    );
  }
}

/** A goal set apart from the tiers must stay equal to the last threshold. */
export function assertGoalMatchesTiers(goalMinor: bigint, tiers: readonly TierInput[]): void {
  const last = tiers.at(-1);
  if (last && last.thresholdMinor !== goalMinor) {
    throw new DomainError('PROJECTS_TIERS_INVALID', 'The last tier threshold must equal the goal');
  }
}

export interface FundingState {
  status: ProjectStatus;
  collectedMinor: bigint;
  goalMinor: bigint | null;
}

export interface FundingChange {
  collectedMinor: bigint;
  status: ProjectStatus;
  /** Tiers reached for the first time by this change. */
  unlockedTierIds: string[];
  /** The goal is reached by this change: the project becomes funded. */
  funded: boolean;
  /** A reversal brought the collected amount below the goal of a funded project. */
  backToFunding: boolean;
}

/**
 * Effect of a paid contribution (positive delta) or of its reversal (negative delta). A tier is
 * unlocked as soon as the collected amount reaches its threshold, and stays unlocked (flexible
 * funding, ADR 0038); a closed project keeps its status.
 */
export function applyFundingDelta(
  state: FundingState,
  tiers: readonly TierRecord[],
  deltaMinor: bigint,
): FundingChange {
  const collectedMinor = state.collectedMinor + deltaMinor;
  const unlockedTierIds = tiers
    .filter((tier) => tier.unlockedAt === null && collectedMinor >= tier.thresholdMinor)
    .map((tier) => tier.id);
  const reached = state.goalMinor !== null && collectedMinor >= state.goalMinor;
  const funded = state.status === 'funding' && reached;
  const backToFunding = state.status === 'funded' && !reached;
  const status: ProjectStatus = funded ? 'funded' : backToFunding ? 'funding' : state.status;
  return { collectedMinor, status, unlockedTierIds, funded, backToFunding };
}
