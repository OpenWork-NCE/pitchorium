import type { PayoutAccountStatus } from '@pitchorium/contracts';
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
