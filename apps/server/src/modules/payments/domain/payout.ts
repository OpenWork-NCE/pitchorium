import type { PayoutAccountStatus, PayoutChangeRefusalReason } from '@pitchorium/contracts';
import type { ProviderId } from './capability-matrix';

export interface PayoutAccountRecord {
  userId: string;
  provider: ProviderId;
  country: string;
  currency: string;
  providerAccountId: string;
  status: PayoutAccountStatus;
  onboarding: 'hosted' | 'bank_details';
  kycMode: 'provider' | 'manual_review';
  providerVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KycSubmissionRecord {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  documentMediaIds: string[];
  submittedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
}

/** What the provider reports of a payout account (hosted onboarding, verification). */
export interface PayoutAccountState {
  status: PayoutAccountStatus;
  /** The provider verified the identity of the holder (KYC mode `provider`). */
  verified: boolean;
}

/**
 * KYC of a holder (section 9.5, ADR 0050): with Stripe Connect, the verification state of the
 * account is authoritative; on the other routes, the latest manual review.
 */
export function isKycVerified(
  account: PayoutAccountRecord | null,
  latest: KycSubmissionRecord | null,
): boolean {
  if (!account) return latest?.status === 'approved';
  return account.kycMode === 'provider' ? account.providerVerified : latest?.status === 'approved';
}

/** Collected contributions open when the holder is verified and the account active. */
export function collectionOpen(
  account: PayoutAccountRecord | null,
  latest: KycSubmissionRecord | null,
): boolean {
  return account?.status === 'active' && isKycVerified(account, latest);
}

/** What decides whether a holder may change their payout option now (ADR 0134). */
export interface PayoutChangeFacts {
  current: { provider: string; country: string };
  /** Collected contributions are open on the current account (active, covered, KYC). */
  collecting: boolean;
  /** A project of the holder is in funding (`funding` or `funded`, before its end). */
  campaignInProgress: boolean;
  /** Payment sessions are still pending on the current account. */
  paymentsPending: boolean;
}

/**
 * Why the payout option cannot change now, or null. A change never moves an existing account
 * at the provider (the country of a Stripe account is final): it opens a new one, and the
 * contributions already paid keep their own account. It is refused while a campaign collects on
 * the current account, so that one campaign is not split between two rails, and while payments
 * are pending on it. A holder whose account no longer collects (no longer covered, restricted,
 * identity not verified) may change during a campaign.
 */
export function payoutChangeRefusal(
  facts: PayoutChangeFacts,
  choice?: { provider: string; country: string },
): PayoutChangeRefusalReason | null {
  if (
    choice &&
    choice.provider === facts.current.provider &&
    choice.country === facts.current.country
  ) {
    return 'same_option';
  }
  if (facts.campaignInProgress && facts.collecting) return 'campaign_in_progress';
  if (facts.paymentsPending) return 'payments_pending';
  return null;
}
