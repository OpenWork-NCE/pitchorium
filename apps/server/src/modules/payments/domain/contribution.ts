import type {
  ContributionKind,
  ContributionRequestKind,
  ContributionStatus,
  FxRateSource,
  PaymentMethod,
  RewardReservationState,
} from '@pitchorium/contracts';
import { DomainError, type Money } from '../../../platform/kernel';
import type { ProviderId } from './capability-matrix';

export interface ContributionRecord {
  id: string;
  projectId: string;
  contributorId: string;
  organizationId: string | null;
  /** Owner of the project when the payment was started: its payout account receives it. */
  holderId: string;
  kind: ContributionKind;
  status: ContributionStatus;
  method: PaymentMethod;
  country: string | null;
  provider: ProviderId;
  providerAccountId: string;
  providerSessionId: string | null;
  providerPaymentId: string | null;
  paymentUrl: string | null;
  amountMinor: bigint;
  currency: string;
  eurMinor: bigint;
  rateUnitsPerEur: string;
  rateSource: FxRateSource;
  rateAt: Date;
  commissionMinor: bigint;
  commissionRateBps: number;
  commissionVersion: string;
  providerFeeMinor: bigint | null;
  refundedMinor: bigint;
  refundedEurMinor: bigint;
  commissionRefundedMinor: bigint;
  /** Amount lost in disputes, in the paid currency and in EUR. */
  lostMinor: bigint;
  lostEurMinor: bigint;
  rewardId: string | null;
  rewardState: RewardReservationState;
  publicDisplay: boolean;
  anonymous: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  succeededAt: Date | null;
  endedAt: Date | null;
}

/**
 * State machine of a contribution (ADR 0043): a payment session ends once, in success or not;
 * a paid contribution can be refunded, in parts or in full, or disputed, and a dispute is won
 * or lost. `partially_refunded` keeps the partial refunds apart from the total one.
 */
const TRANSITIONS: Readonly<Record<ContributionStatus, readonly ContributionStatus[]>> = {
  pending_payment: ['succeeded', 'failed', 'expired', 'canceled'],
  succeeded: ['partially_refunded', 'refunded', 'disputed'],
  partially_refunded: ['partially_refunded', 'refunded', 'disputed'],
  disputed: ['dispute_won', 'dispute_lost'],
  dispute_won: ['partially_refunded', 'refunded', 'disputed'],
  dispute_lost: [],
  failed: [],
  expired: [],
  canceled: [],
  refunded: [],
};

export function canTransition(from: ContributionStatus, to: ContributionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ContributionStatus, to: ContributionStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError(
      'PAYMENTS_INVALID_TRANSITION',
      `A contribution cannot go from ${from} to ${to}`,
    );
  }
}

/** The money was taken from the contributor (whatever happened afterwards). */
export function wasPaid(status: ContributionStatus): boolean {
  return (
    status === 'succeeded' ||
    status === 'partially_refunded' ||
    status === 'refunded' ||
    status === 'disputed' ||
    status === 'dispute_won' ||
    status === 'dispute_lost'
  );
}

/** Statuses from which an administrator may refund. */
export function isRefundable(status: ContributionStatus): boolean {
  return status === 'succeeded' || status === 'partially_refunded' || status === 'dispute_won';
}

/** Paid amount still held by the holder: not refunded and not lost in a dispute. */
export function remainingMinor(contribution: ContributionRecord): bigint {
  return contribution.amountMinor - contribution.refundedMinor - contribution.lostMinor;
}

export function netEurMinor(contribution: ContributionRecord): bigint {
  if (!wasPaid(contribution.status)) return 0n;
  return contribution.eurMinor - contribution.refundedEurMinor - contribution.lostEurMinor;
}

/**
 * Only donations, rewards crowdfunding and love money are collected (section 9.1). Grants,
 * honour loans and convertible bonds stay expressions of interest. Equity and loans are refused
 * even when their feature flags are on, as long as no licensed adapter exists (ADR 0051).
 */
export function assertCollectible(kind: ContributionRequestKind): ContributionKind {
  switch (kind) {
    case 'donation':
    case 'reward_crowdfunding':
    case 'love_money':
      return kind;
    case 'equity':
    case 'loan':
      throw new DomainError(
        'PAYMENTS_LICENSED_PARTNER_REQUIRED',
        `${kind} is never paid online without a licensed partner`,
      );
    case 'grant':
    case 'honor_loan':
    case 'convertible_bonds':
      throw new DomainError(
        'PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE',
        `${kind} is an expression of interest, not a payment`,
      );
  }
}

/** What the provider reports of a payment session, read through its API (never trusted from a webhook). */
export interface ProviderSnapshot {
  status: 'pending' | 'succeeded' | 'failed' | 'expired' | 'canceled';
  /** Our contribution identifier, as stored by the provider. */
  reference: string | null;
  amount: Money | null;
  paymentId: string | null;
  /** Actual fee of the provider, once known. */
  providerFee: Money | null;
  /** EUR equivalent from the settlement data of the provider, when it reports one. */
  settledEur: Money | null;
  refunds: readonly ProviderRefund[];
  disputes: readonly ProviderDispute[];
}

export interface ProviderRefund {
  providerRefundId: string;
  amount: Money;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface ProviderDispute {
  providerDisputeId: string;
  amount: Money;
  status: 'open' | 'won' | 'lost';
}

/**
 * Checks the verified payment against the contribution before any effect (amount, currency,
 * reference); a mismatch is never applied, it becomes a reconciliation discrepancy.
 */
export function paymentMismatch(
  contribution: ContributionRecord,
  snapshot: ProviderSnapshot,
): string | null {
  if (snapshot.reference !== null && snapshot.reference !== contribution.id) {
    return `reference ${snapshot.reference}`;
  }
  if (
    !snapshot.amount ||
    snapshot.amount.currency !== contribution.currency ||
    snapshot.amount.amountMinor !== contribution.amountMinor
  ) {
    return snapshot.amount
      ? `${snapshot.amount.amountMinor} ${snapshot.amount.currency}`
      : 'no amount';
  }
  return null;
}
