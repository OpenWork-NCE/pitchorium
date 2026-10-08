/** BullMQ queue of the trust module (worker). */
export const TRUST_QUEUE = 'trust.moderation';

export const TRUST_JOBS = {
  /** Announces the suspensions over by their end date (every 5 minutes). */
  endSuspensions: 'end-suspensions',
  /** Purges the activity counted by the signals (daily). */
  purgeActivity: 'purge-activity',
  /** Refunds one contribution of a frozen project. */
  refund: 'refund',
  /** Emails a notifier without an account (receipt or outcome). */
  notice: 'notice',
} as const;

export interface RefundJob {
  contributionId: string;
  reason: string;
}

export interface NoticeJob {
  reportId: string;
  kind: 'received' | 'resolved';
}
