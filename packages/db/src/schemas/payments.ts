import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const paymentsSchema = pgSchema('payments');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const minorUnits = (name: string) => bigint(name, { mode: 'bigint' });

/**
 * Payout account of a holder at the provider of the route of its country (section 9.5). The
 * bank details stay at the provider: only the account reference is kept.
 */
export const paymentsPayoutAccounts = paymentsSchema.table('payout_accounts', {
  userId: uuid('user_id').primaryKey(),
  provider: text('provider').notNull(),
  country: text('country').notNull(),
  currency: text('currency').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  status: text('status').notNull(),
  onboarding: text('onboarding').notNull(),
  kycMode: text('kyc_mode').notNull(),
  /** Verification state reported by the provider (kyc_mode `provider`). */
  providerVerified: boolean('provider_verified').notNull(),
  createdAt: timestamptz('created_at').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});

/** Manual KYC review of a holder (kyc_mode `manual_review`), documents in media (private). */
export const paymentsKycSubmissions = paymentsSchema.table(
  'kyc_submissions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    status: text('status').notNull(),
    documentMediaIds: uuid('document_media_ids').array().notNull(),
    submittedAt: timestamptz('submitted_at').notNull(),
    decidedAt: timestamptz('decided_at'),
    decidedBy: uuid('decided_by'),
    decisionReason: text('decision_reason'),
  },
  (table) => [
    index('kyc_submissions_user_idx').on(table.userId, table.submittedAt),
    index('kyc_submissions_status_idx').on(table.status, table.submittedAt, table.id),
    uniqueIndex('kyc_submissions_pending_uq')
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/**
 * Collected contributions (section 9.3). Amounts in minor units of the paid currency, with the
 * EUR equivalent applied to the project, frozen at the creation of the payment session.
 */
export const paymentsContributions = paymentsSchema.table(
  'contributions',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id').notNull(),
    contributorId: uuid('contributor_id').notNull(),
    organizationId: uuid('organization_id'),
    holderId: uuid('holder_id').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    method: text('method').notNull(),
    country: text('country'),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    providerSessionId: text('provider_session_id'),
    providerPaymentId: text('provider_payment_id'),
    paymentUrl: text('payment_url'),
    amountMinor: minorUnits('amount_minor').notNull(),
    currency: text('currency').notNull(),
    eurMinor: minorUnits('eur_minor').notNull(),
    rateUnitsPerEur: text('rate_units_per_eur').notNull(),
    rateSource: text('rate_source').notNull(),
    rateAt: timestamptz('rate_at').notNull(),
    commissionMinor: minorUnits('commission_minor').notNull(),
    commissionRateBps: integer('commission_rate_bps').notNull(),
    commissionVersion: text('commission_version').notNull(),
    providerFeeMinor: minorUnits('provider_fee_minor'),
    refundedMinor: minorUnits('refunded_minor').notNull(),
    refundedEurMinor: minorUnits('refunded_eur_minor').notNull(),
    commissionRefundedMinor: minorUnits('commission_refunded_minor').notNull(),
    lostMinor: minorUnits('lost_minor').notNull(),
    lostEurMinor: minorUnits('lost_eur_minor').notNull(),
    rewardId: uuid('reward_id'),
    rewardState: text('reward_state').notNull(),
    publicDisplay: boolean('public_display').notNull(),
    anonymous: boolean('anonymous').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    succeededAt: timestamptz('succeeded_at'),
    endedAt: timestamptz('ended_at'),
  },
  (table) => [
    index('contributions_contributor_idx').on(table.contributorId, table.createdAt, table.id),
    index('contributions_project_idx').on(table.projectId, table.createdAt, table.id),
    index('contributions_organization_idx')
      .on(table.organizationId, table.createdAt)
      .where(sql`${table.organizationId} is not null`),
    index('contributions_pending_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'pending_payment'`),
    index('contributions_rate_idx').on(table.contributorId, table.method, table.createdAt),
    uniqueIndex('contributions_provider_session_uq').on(table.provider, table.providerSessionId),
  ],
);

/** Refunds, total or partial, with the commission refunded in proportion. */
export const paymentsRefunds = paymentsSchema.table(
  'refunds',
  {
    id: uuid('id').primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => paymentsContributions.id, { onDelete: 'restrict' }),
    providerRefundId: text('provider_refund_id'),
    amountMinor: minorUnits('amount_minor').notNull(),
    currency: text('currency').notNull(),
    commissionMinor: minorUnits('commission_minor').notNull(),
    eurMinor: minorUnits('eur_minor').notNull(),
    status: text('status').notNull(),
    origin: text('origin').notNull(),
    reason: text('reason').notNull(),
    requestedBy: uuid('requested_by'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('refunds_contribution_idx').on(table.contributionId),
    uniqueIndex('refunds_provider_refund_uq').on(table.providerRefundId),
  ],
);

/** Disputes (chargebacks) reported by the provider. */
export const paymentsDisputes = paymentsSchema.table(
  'disputes',
  {
    id: uuid('id').primaryKey(),
    contributionId: uuid('contribution_id')
      .notNull()
      .references(() => paymentsContributions.id, { onDelete: 'restrict' }),
    providerDisputeId: text('provider_dispute_id').notNull(),
    amountMinor: minorUnits('amount_minor').notNull(),
    currency: text('currency').notNull(),
    eurMinor: minorUnits('eur_minor').notNull(),
    status: text('status').notNull(),
    openedAt: timestamptz('opened_at').notNull(),
    closedAt: timestamptz('closed_at'),
  },
  (table) => [uniqueIndex('disputes_provider_dispute_uq').on(table.providerDisputeId)],
);

/**
 * Double-entry ledger (ADR 0048): an entry per financial event, never updated; a correction is
 * a counter-entry. Its lines balance per currency.
 */
export const paymentsLedgerEntries = paymentsSchema.table(
  'ledger_entries',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    /** Business identifier of the event (contribution, refund, dispute, decision): once each. */
    sourceId: text('source_id').notNull(),
    contributionId: uuid('contribution_id'),
    offlineContributionId: uuid('offline_contribution_id'),
    projectId: uuid('project_id').notNull(),
    reversesEntryId: uuid('reverses_entry_id'),
    occurredAt: timestamptz('occurred_at').notNull(),
    recordedAt: timestamptz('recorded_at').notNull(),
  },
  (table) => [
    uniqueIndex('ledger_entries_source_uq').on(table.kind, table.sourceId),
    index('ledger_entries_contribution_idx').on(table.contributionId),
    index('ledger_entries_project_idx').on(table.projectId),
  ],
);

export const paymentsLedgerLines = paymentsSchema.table(
  'ledger_lines',
  {
    id: uuid('id').primaryKey(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => paymentsLedgerEntries.id, { onDelete: 'restrict' }),
    account: text('account').notNull(),
    currency: text('currency').notNull(),
    /** Signed: the lines of an entry sum to zero per currency. */
    amountMinor: minorUnits('amount_minor').notNull(),
  },
  (table) => [
    index('ledger_lines_entry_idx').on(table.entryId),
    index('ledger_lines_account_idx').on(table.account, table.currency),
  ],
);

/** Off-platform contributions (section 9.3, fallback, ADR 0049). */
export const paymentsOfflineContributions = paymentsSchema.table(
  'offline_contributions',
  {
    id: uuid('id').primaryKey(),
    projectId: uuid('project_id').notNull(),
    contributorId: uuid('contributor_id').notNull(),
    declaredBy: text('declared_by').notNull(),
    declarerId: uuid('declarer_id').notNull(),
    kind: text('kind').notNull(),
    status: text('status').notNull(),
    amountMinor: minorUnits('amount_minor'),
    currency: text('currency'),
    eurMinor: minorUnits('eur_minor'),
    description: text('description'),
    proofMediaIds: uuid('proof_media_ids').array().notNull(),
    confirmedAt: timestamptz('confirmed_at'),
    confirmedBy: uuid('confirmed_by'),
    decidedAt: timestamptz('decided_at'),
    decidedBy: uuid('decided_by'),
    decisionReason: text('decision_reason'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('offline_contributions_project_idx').on(table.projectId, table.createdAt, table.id),
    index('offline_contributions_contributor_idx').on(
      table.contributorId,
      table.createdAt,
      table.id,
    ),
    index('offline_contributions_status_idx').on(table.status, table.createdAt, table.id),
  ],
);

/** Notifications received from the providers, kept for traceability (references only). */
export const paymentsProviderEvents = paymentsSchema.table(
  'provider_events',
  {
    id: uuid('id').primaryKey(),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    type: text('type').notNull(),
    contributionId: uuid('contribution_id'),
    providerAccountId: text('provider_account_id'),
    receivedAt: timestamptz('received_at').notNull(),
  },
  (table) => [
    uniqueIndex('provider_events_external_uq').on(table.provider, table.externalId),
    index('provider_events_contribution_idx').on(table.contributionId),
  ],
);

/** Daily reconciliation (ADR 0048): discrepancies are kept until an administrator resolves them. */
export const paymentsReconciliationRuns = paymentsSchema.table('reconciliation_runs', {
  id: uuid('id').primaryKey(),
  periodStart: timestamptz('period_start').notNull(),
  periodEnd: timestamptz('period_end').notNull(),
  startedAt: timestamptz('started_at').notNull(),
  finishedAt: timestamptz('finished_at'),
  checkedTransactions: integer('checked_transactions').notNull(),
  discrepancies: integer('discrepancies').notNull(),
});

export const paymentsDiscrepancies = paymentsSchema.table(
  'discrepancies',
  {
    id: uuid('id').primaryKey(),
    /** Null when detected while processing a notification, outside a reconciliation run. */
    runId: uuid('run_id').references(() => paymentsReconciliationRuns.id, {
      onDelete: 'restrict',
    }),
    kind: text('kind').notNull(),
    provider: text('provider'),
    reference: text('reference').notNull(),
    contributionId: uuid('contribution_id'),
    projectId: uuid('project_id'),
    expected: text('expected'),
    actual: text('actual'),
    status: text('status').notNull(),
    detectedAt: timestamptz('detected_at').notNull(),
    resolvedAt: timestamptz('resolved_at'),
    resolvedBy: uuid('resolved_by'),
    resolution: text('resolution'),
  },
  (table) => [
    index('discrepancies_status_idx').on(table.status, table.detectedAt, table.id),
    uniqueIndex('discrepancies_open_uq')
      .on(table.kind, table.reference)
      .where(sql`${table.status} = 'open'`),
  ],
);

/**
 * State of the simulated provider (development and tests only, refused in production): the
 * payment sessions it hosts, their refunds and disputes, and the accounts it opened.
 */
export const paymentsSimulatedSessions = paymentsSchema.table('simulated_sessions', {
  id: text('id').primaryKey(),
  reference: uuid('reference').notNull(),
  accountId: text('account_id').notNull(),
  amountMinor: minorUnits('amount_minor').notNull(),
  currency: text('currency').notNull(),
  commissionMinor: minorUnits('commission_minor').notNull(),
  feeMinor: minorUnits('fee_minor').notNull(),
  status: text('status').notNull(),
  paymentId: text('payment_id'),
  refunds: jsonb('refunds').notNull(),
  disputes: jsonb('disputes').notNull(),
  expiresAt: timestamptz('expires_at').notNull(),
  createdAt: timestamptz('created_at').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});

export const paymentsSimulatedAccounts = paymentsSchema.table('simulated_accounts', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  country: text('country').notNull(),
  createdAt: timestamptz('created_at').notNull(),
});
