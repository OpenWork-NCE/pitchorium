import type { ContributionStatus } from '@pitchorium/contracts';
import { DomainError, Money } from '../../../platform/kernel';
import { commissionRefundFor, eurPartFor } from './commission';
import { type ContributionRecord, remainingMinor } from './contribution';

/** What a refund does to a contribution, by the rules the refund applies (section 13). */
export interface RefundEffect {
  full: boolean;
  status: Extract<ContributionStatus, 'refunded' | 'partially_refunded'>;
  /** Share of the commission given back, in the currency of the contribution. */
  commissionMinor: bigint;
  /** Euros removed from the collected amount of the project. */
  eurMinor: bigint;
  /** A confirmed reward is released by a full refund. */
  rewardReleased: boolean;
}

export function refundEffect(contribution: ContributionRecord, amountMinor: bigint): RefundEffect {
  const full = amountMinor === remainingMinor(contribution);
  return {
    full,
    status: full ? 'refunded' : 'partially_refunded',
    commissionMinor: commissionRefundFor(
      contribution.commissionMinor,
      contribution.amountMinor,
      contribution.refundedMinor,
      amountMinor,
    ),
    eurMinor: eurPartFor(
      contribution.eurMinor,
      contribution.amountMinor,
      contribution.refundedMinor + contribution.lostMinor,
      amountMinor,
    ),
    rewardReleased: full && contribution.rewardState === 'confirmed',
  };
}

/**
 * The amount of a refund: all that remains by default, else the amount asked, in the currency
 * of the contribution, positive and within what remains once the pending refunds are deducted.
 */
export function refundAmountOf(
  contribution: ContributionRecord,
  requested: { amountMinor: string; currency: string } | undefined,
  pendingMinor: bigint,
): Money {
  const refundable = remainingMinor(contribution) - pendingMinor;
  const amount = requested
    ? Money.fromJSON(requested)
    : Money.of(refundable, contribution.currency);
  if (
    amount.currency !== contribution.currency ||
    amount.amountMinor <= 0n ||
    amount.amountMinor > refundable
  ) {
    throw new DomainError('PAYMENTS_REFUND_INVALID', 'The refund exceeds the refundable amount');
  }
  return amount;
}
