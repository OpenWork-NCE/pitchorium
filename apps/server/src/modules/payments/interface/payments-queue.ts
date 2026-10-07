/** BullMQ queue of the payments module (worker): provider reads and scheduled tasks. */
export const PAYMENTS_QUEUE = 'payments.provider-sync';

export const PAYMENTS_JOBS = {
  syncContribution: 'sync-contribution',
  syncPayoutAccount: 'sync-payout-account',
  syncPaymentReference: 'sync-payment-reference',
  expirePending: 'expire-pending',
  releaseOrphans: 'release-orphans',
  reconcile: 'reconcile',
} as const;

export interface SyncContributionJob {
  contributionId: string;
  providerPaymentId: string | null;
}

export interface SyncPayoutAccountJob {
  provider: string;
  providerAccountId: string;
}

export interface SyncPaymentReferenceJob {
  provider: string;
  paymentReference: string;
}
