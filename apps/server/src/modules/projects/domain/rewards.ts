import type { FundingInstrument, RewardInstrument } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface RewardRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  minAmountMinor: bigint;
  instruments: RewardInstrument[];
  /** Null: unlimited. */
  quantity: number | null;
  reserved: number;
  confirmed: number;
  estimatedDelivery: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationStatus = 'reserved' | 'confirmed' | 'released';

export interface ReservationRecord {
  contributionId: string;
  rewardId: string;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A reward is obtained with instruments the project accepts; love money has no material
 * reward (section 11.3), which the contract enforces by allowing donation and reward
 * crowdfunding only.
 */
export function assertRewardInstruments(
  instruments: readonly RewardInstrument[],
  accepted: readonly FundingInstrument[],
): void {
  if (instruments.some((instrument) => !accepted.includes(instrument))) {
    throw new DomainError(
      'PROJECTS_REWARD_INVALID',
      'Reward instruments must be accepted by the project',
    );
  }
}

/** Units still available, null when unlimited. */
export function available(reward: RewardRecord): number | null {
  return reward.quantity === null
    ? null
    : Math.max(0, reward.quantity - reward.reserved - reward.confirmed);
}

export function assertAvailable(reward: RewardRecord): void {
  if (available(reward) === 0) {
    throw new DomainError('PROJECTS_REWARD_SOLD_OUT', 'Reward sold out');
  }
}

/** A limited quantity may not go below what is already reserved or confirmed. */
export function assertQuantity(reward: RewardRecord, quantity: number | null): void {
  if (quantity !== null && quantity < reward.reserved + reward.confirmed) {
    throw new DomainError(
      'PROJECTS_REWARD_INVALID',
      'The quantity is below the reserved and confirmed units',
    );
  }
}
