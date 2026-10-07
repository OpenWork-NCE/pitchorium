import { EUR } from './fx';

/**
 * Chart of accounts of the ledger (ADR 0048). Pitchorium holds no funds: the accounts mirror
 * what happens at the providers and off the platform, they are never a balance a member could
 * use. Amounts are signed, in minor units, per currency; the lines of an entry sum to zero per
 * currency.
 */
export const LEDGER_ACCOUNTS = {
  /** Paid by the contributors (negative: money that came in). */
  contributorFunds: 'contributor_funds',
  /** Part of the holder, at the provider then on their bank account. */
  holderShare: 'holder_share',
  /** Commission of Pitchorium, taken at the source by the provider. */
  platformCommission: 'platform_commission',
  /** Fees of the provider, borne by the holder. */
  providerFees: 'provider_fees',
  /** Given back to the contributors. */
  refunds: 'refunds',
  /** Withdrawn by a dispute (chargeback). */
  disputes: 'disputes',
  /** Off-platform money declared and validated (negative: money that came in). */
  offlineDeclared: 'offline_declared',
  /** Off-platform money received by the holder. */
  offlineReceipts: 'offline_receipts',
  /** EUR memo: sources of the collected amounts of the projects. */
  fundingSources: 'funding_sources',
  /** EUR memo: collected amount of a project, equal to its total in the projects module. */
  projectFunding: 'project_funding',
} as const;

export type LedgerAccount = (typeof LEDGER_ACCOUNTS)[keyof typeof LEDGER_ACCOUNTS];

export const LEDGER_KINDS = [
  'payment_succeeded',
  'provider_fee',
  'refund',
  'dispute_opened',
  'dispute_won',
  'dispute_lost',
  'offline_validated',
] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface LedgerLine {
  account: LedgerAccount;
  currency: string;
  amountMinor: bigint;
}

export interface LedgerEntryDraft {
  kind: LedgerKind;
  /** Business identifier of the event: an entry is recorded once per kind and source. */
  sourceId: string;
  projectId: string;
  contributionId: string | null;
  offlineContributionId: string | null;
  /** The entry this one cancels (counter-entry), never updated itself. */
  reversesEntryId: string | null;
  occurredAt: Date;
  lines: LedgerLine[];
}

export class UnbalancedLedgerEntryError extends Error {
  constructor(
    readonly kind: LedgerKind,
    readonly currency: string,
    readonly sum: bigint,
  ) {
    super(`Ledger entry ${kind} does not balance in ${currency}: ${sum}`);
    this.name = 'UnbalancedLedgerEntryError';
  }
}

/** Sum of the lines per currency. */
export function balances(lines: readonly LedgerLine[]): Map<string, bigint> {
  const sums = new Map<string, bigint>();
  for (const line of lines) {
    sums.set(line.currency, (sums.get(line.currency) ?? 0n) + line.amountMinor);
  }
  return sums;
}

export function assertBalanced(entry: Pick<LedgerEntryDraft, 'kind' | 'lines'>): void {
  for (const [currency, sum] of balances(entry.lines)) {
    if (sum !== 0n) throw new UnbalancedLedgerEntryError(entry.kind, currency, sum);
  }
}

const line = (account: LedgerAccount, currency: string, amountMinor: bigint): LedgerLine => ({
  account,
  currency,
  amountMinor,
});

/** Lines with a zero amount add nothing: they are left out. */
function entry(draft: LedgerEntryDraft): LedgerEntryDraft {
  const lines = draft.lines.filter((candidate) => candidate.amountMinor !== 0n);
  const result = { ...draft, lines };
  assertBalanced(result);
  return result;
}

interface ContributionRef {
  id: string;
  projectId: string;
  currency: string;
}

type Base = Pick<LedgerEntryDraft, 'occurredAt'>;

/**
 * A payment succeeded: the contributor paid, the provider kept its fee (when already known),
 * Pitchorium its commission and the holder the rest; the project collects the EUR equivalent.
 */
export function paymentSucceeded(
  contribution: ContributionRef & {
    amountMinor: bigint;
    commissionMinor: bigint;
    eurMinor: bigint;
  },
  providerFeeMinor: bigint,
  base: Base,
): LedgerEntryDraft {
  const { currency } = contribution;
  return entry({
    ...base,
    kind: 'payment_succeeded',
    sourceId: contribution.id,
    projectId: contribution.projectId,
    contributionId: contribution.id,
    offlineContributionId: null,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.contributorFunds, currency, -contribution.amountMinor),
      line(
        LEDGER_ACCOUNTS.holderShare,
        currency,
        contribution.amountMinor - contribution.commissionMinor - providerFeeMinor,
      ),
      line(LEDGER_ACCOUNTS.platformCommission, currency, contribution.commissionMinor),
      line(LEDGER_ACCOUNTS.providerFees, currency, providerFeeMinor),
      line(LEDGER_ACCOUNTS.fundingSources, EUR, -contribution.eurMinor),
      line(LEDGER_ACCOUNTS.projectFunding, EUR, contribution.eurMinor),
    ],
  });
}

/** The fee of the provider became known after the payment: borne by the holder. */
export function providerFeeRecorded(
  contribution: ContributionRef,
  feeMinor: bigint,
  base: Base,
): LedgerEntryDraft {
  return entry({
    ...base,
    kind: 'provider_fee',
    sourceId: contribution.id,
    projectId: contribution.projectId,
    contributionId: contribution.id,
    offlineContributionId: null,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.holderShare, contribution.currency, -feeMinor),
      line(LEDGER_ACCOUNTS.providerFees, contribution.currency, feeMinor),
    ],
  });
}

/**
 * A refund succeeded: the contributor is paid back, the commission is refunded in proportion,
 * the holder bears the rest (the fees of the provider are not refunded).
 */
export function refundSucceeded(
  contribution: ContributionRef,
  refund: { id: string; amountMinor: bigint; commissionMinor: bigint; eurMinor: bigint },
  base: Base,
): LedgerEntryDraft {
  const { currency } = contribution;
  return entry({
    ...base,
    kind: 'refund',
    sourceId: refund.id,
    projectId: contribution.projectId,
    contributionId: contribution.id,
    offlineContributionId: null,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.refunds, currency, refund.amountMinor),
      line(LEDGER_ACCOUNTS.holderShare, currency, -(refund.amountMinor - refund.commissionMinor)),
      line(LEDGER_ACCOUNTS.platformCommission, currency, -refund.commissionMinor),
      line(LEDGER_ACCOUNTS.fundingSources, EUR, refund.eurMinor),
      line(LEDGER_ACCOUNTS.projectFunding, EUR, -refund.eurMinor),
    ],
  });
}

/** A dispute opened: the provider withdraws the disputed amount from the holder. */
export function disputeOpened(
  contribution: ContributionRef,
  dispute: { id: string; amountMinor: bigint },
  base: Base,
): LedgerEntryDraft {
  return entry({
    ...base,
    kind: 'dispute_opened',
    sourceId: dispute.id,
    projectId: contribution.projectId,
    contributionId: contribution.id,
    offlineContributionId: null,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.disputes, contribution.currency, dispute.amountMinor),
      line(LEDGER_ACCOUNTS.holderShare, contribution.currency, -dispute.amountMinor),
    ],
  });
}

/** A dispute won: counter-entry of its opening, the amount returns to the holder. */
export function disputeWon(
  opening: Pick<LedgerEntryDraft, 'lines' | 'projectId' | 'contributionId'> & { id: string },
  disputeId: string,
  base: Base,
): LedgerEntryDraft {
  return entry({
    ...base,
    kind: 'dispute_won',
    sourceId: disputeId,
    projectId: opening.projectId,
    contributionId: opening.contributionId,
    offlineContributionId: null,
    reversesEntryId: opening.id,
    lines: opening.lines.map((original) => ({ ...original, amountMinor: -original.amountMinor })),
  });
}

/** A dispute lost: the project no longer collects the EUR equivalent of the disputed amount. */
export function disputeLost(
  contribution: ContributionRef,
  dispute: { id: string; eurMinor: bigint },
  base: Base,
): LedgerEntryDraft {
  return entry({
    ...base,
    kind: 'dispute_lost',
    sourceId: dispute.id,
    projectId: contribution.projectId,
    contributionId: contribution.id,
    offlineContributionId: null,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.fundingSources, EUR, dispute.eurMinor),
      line(LEDGER_ACCOUNTS.projectFunding, EUR, -dispute.eurMinor),
    ],
  });
}

/** An off-platform contribution validated on proof: it counts in the collected amount. */
export function offlineValidated(
  offline: {
    id: string;
    projectId: string;
    amountMinor: bigint;
    currency: string;
    eurMinor: bigint;
  },
  base: Base,
): LedgerEntryDraft {
  return entry({
    ...base,
    kind: 'offline_validated',
    sourceId: offline.id,
    projectId: offline.projectId,
    contributionId: null,
    offlineContributionId: offline.id,
    reversesEntryId: null,
    lines: [
      line(LEDGER_ACCOUNTS.offlineDeclared, offline.currency, -offline.amountMinor),
      line(LEDGER_ACCOUNTS.offlineReceipts, offline.currency, offline.amountMinor),
      line(LEDGER_ACCOUNTS.fundingSources, EUR, -offline.eurMinor),
      line(LEDGER_ACCOUNTS.projectFunding, EUR, offline.eurMinor),
    ],
  });
}
