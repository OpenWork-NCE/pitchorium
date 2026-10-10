import type { Contribution, ContributionStatus } from '@pitchorium/contracts';

/**
 * How the return page reads a status of the api (docs/architecture/payments.md, state machine):
 * `pending` while the provider has not settled, `paid` once the payment succeeded (refunds and
 * disputes come later and keep it paid at the return), `unpaid` for an attempt that ended without
 * payment, which can be tried again.
 */
export type ReturnOutcome = 'pending' | 'paid' | 'unpaid';

const OUTCOMES: Record<ContributionStatus, ReturnOutcome> = {
  pending_payment: 'pending',
  succeeded: 'paid',
  partially_refunded: 'paid',
  refunded: 'paid',
  disputed: 'paid',
  dispute_won: 'paid',
  dispute_lost: 'paid',
  failed: 'unpaid',
  expired: 'unpaid',
  canceled: 'unpaid',
};

export function returnOutcome(status: ContributionStatus): ReturnOutcome {
  return OUTCOMES[status];
}

/** Tone of a status badge: its meaning only (direction.md), never the copper. */
export function statusTone(
  status: ContributionStatus,
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  switch (status) {
    case 'succeeded':
    case 'dispute_won':
      return 'success';
    case 'pending_payment':
      return 'info';
    case 'partially_refunded':
    case 'refunded':
    case 'disputed':
      return 'warning';
    case 'failed':
    case 'dispute_lost':
      return 'danger';
    case 'expired':
    case 'canceled':
      return 'neutral';
  }
}

/**
 * A contribution of the member to this project still waiting for its payment, whose session has
 * not expired: it is proposed again rather than a new one created (§9.3). The api says whether it
 * is pending and until when; the page only compares that instant with now.
 */
export function resumableContribution(
  contributions: readonly Contribution[],
  projectId: string,
  now: number,
): Contribution | null {
  return (
    contributions.find(
      (contribution) =>
        contribution.project.id === projectId &&
        contribution.status === 'pending_payment' &&
        contribution.paymentUrl !== null &&
        Date.parse(contribution.expiresAt) > now,
    ) ?? null
  );
}

/** The session of a pending contribution, and the rate it locked, are over. */
export function lockExpired(contribution: Pick<Contribution, 'expiresAt'>, now: number): boolean {
  return Date.parse(contribution.expiresAt) <= now;
}
