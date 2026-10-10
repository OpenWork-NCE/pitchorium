import { Injectable } from '@nestjs/common';
import type {
  ContributionKind,
  ContributionStatus,
  DiscrepancyKind,
  FxRateSource,
  OfflineContributionKind,
  OfflineContributionStatus,
  PaymentMethod,
  PayoutAccountStatus,
  RewardReservationState,
} from '@pitchorium/contracts';
import { and, asc, desc, eq, gt, gte, inArray, lt, sql, type SQL } from '@pitchorium/db/orm';
import {
  paymentsContributions,
  paymentsDiscrepancies,
  paymentsDisputes,
  paymentsKycSubmissions,
  paymentsLedgerEntries,
  paymentsLedgerLines,
  paymentsOfflineContributions,
  paymentsPayoutAccounts,
  paymentsProviderEvents,
  paymentsReconciliationRuns,
  paymentsRefunds,
} from '@pitchorium/db/schemas/payments';
import { TransactionManager } from '../../../platform/database';
import { IdGenerator, type KeysetPosition } from '../../../platform/kernel';
import {
  type ContributionFilter,
  type ContributionPatch,
  type DiscrepancyRecord,
  type DisputeRecord,
  type LedgerEntryRecord,
  PaymentsRepository,
  type RefundRecord,
} from '../application/ports';
import type { ProviderId } from '../domain/capability-matrix';
import type { ContributionRecord } from '../domain/contribution';
import type { LedgerAccount, LedgerKind } from '../domain/ledger';
import type { OfflineContributionRecord } from '../domain/offline';
import type { KycSubmissionRecord, PayoutAccountRecord } from '../domain/payout';

type ContributionRow = typeof paymentsContributions.$inferSelect;

const toContribution = (row: ContributionRow): ContributionRecord => ({
  ...row,
  kind: row.kind as ContributionKind,
  status: row.status as ContributionStatus,
  method: row.method as PaymentMethod,
  provider: row.provider as ProviderId,
  rateSource: row.rateSource as FxRateSource,
  rewardState: row.rewardState as RewardReservationState,
});

const toOffline = (
  row: typeof paymentsOfflineContributions.$inferSelect,
): OfflineContributionRecord => ({
  ...row,
  declaredBy: row.declaredBy as OfflineContributionRecord['declaredBy'],
  kind: row.kind as OfflineContributionKind,
  status: row.status as OfflineContributionStatus,
});

const toPayout = (row: typeof paymentsPayoutAccounts.$inferSelect): PayoutAccountRecord => ({
  ...row,
  provider: row.provider as ProviderId,
  status: row.status as PayoutAccountStatus,
  onboarding: row.onboarding as PayoutAccountRecord['onboarding'],
  kycMode: row.kycMode as PayoutAccountRecord['kycMode'],
});

const toKyc = (row: typeof paymentsKycSubmissions.$inferSelect): KycSubmissionRecord => ({
  ...row,
  status: row.status as KycSubmissionRecord['status'],
});

const toRefund = (row: typeof paymentsRefunds.$inferSelect): RefundRecord => ({
  ...row,
  status: row.status as RefundRecord['status'],
  origin: row.origin as RefundRecord['origin'],
});

const toDispute = (row: typeof paymentsDisputes.$inferSelect): DisputeRecord => ({
  ...row,
  status: row.status as DisputeRecord['status'],
});

const toDiscrepancy = (row: typeof paymentsDiscrepancies.$inferSelect): DiscrepancyRecord => ({
  ...row,
  kind: row.kind as DiscrepancyKind,
  status: row.status as DiscrepancyRecord['status'],
});

/** Newest first: (date, id) strictly before the position. */
function before(at: SQL, after: KeysetPosition | null): SQL | undefined {
  return after ? sql`${at} < (${after.at}, ${after.key}::uuid)` : undefined;
}

const PAID_STATUSES = [
  'succeeded',
  'partially_refunded',
  'disputed',
  'dispute_won',
  'dispute_lost',
];

@Injectable()
export class DrizzlePaymentsRepository extends PaymentsRepository {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async insertContribution(contribution: ContributionRecord): Promise<void> {
    await this.db.insert(paymentsContributions).values(contribution);
  }

  async findContribution(id: string): Promise<ContributionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsContributions)
      .where(eq(paymentsContributions.id, id));
    return row ? toContribution(row) : null;
  }

  async lockContribution(id: string): Promise<ContributionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsContributions)
      .where(eq(paymentsContributions.id, id))
      .for('update');
    return row ? toContribution(row) : null;
  }

  async findContributionByPayment(
    provider: ProviderId,
    providerPaymentId: string,
  ): Promise<ContributionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.provider, provider),
          eq(paymentsContributions.providerPaymentId, providerPaymentId),
        ),
      );
    return row ? toContribution(row) : null;
  }

  async updateContribution(id: string, patch: ContributionPatch): Promise<void> {
    await this.db.update(paymentsContributions).set(patch).where(eq(paymentsContributions.id, id));
  }

  async contributions(
    filter: ContributionFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ContributionRecord[]> {
    const table = paymentsContributions;
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          filter.contributorId ? eq(table.contributorId, filter.contributorId) : undefined,
          filter.projectId ? eq(table.projectId, filter.projectId) : undefined,
          filter.organizationId ? eq(table.organizationId, filter.organizationId) : undefined,
          filter.status ? eq(table.status, filter.status) : undefined,
          before(sql`(${table.createdAt}, ${table.id})`, after),
        ),
      )
      .orderBy(desc(table.createdAt), desc(table.id))
      .limit(limit);
    return rows.map(toContribution);
  }

  async countRecentContributions(
    contributorId: string,
    since: Date,
    method?: PaymentMethod,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.contributorId, contributorId),
          gte(paymentsContributions.createdAt, since),
          method ? eq(paymentsContributions.method, method) : undefined,
        ),
      );
    return row?.count ?? 0;
  }

  async pendingExpiredBefore(at: Date, limit: number): Promise<ContributionRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.status, 'pending_payment'),
          lt(paymentsContributions.expiresAt, at),
        ),
      )
      .orderBy(asc(paymentsContributions.expiresAt))
      .limit(limit);
    return rows.map(toContribution);
  }

  async heldRewardsOfEnded(limit: number): Promise<ContributionRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.rewardState, 'reserved'),
          inArray(paymentsContributions.status, ['failed', 'expired', 'canceled']),
        ),
      )
      .limit(limit);
    return rows.map(toContribution);
  }

  async contributionsCreatedBetween(from: Date, to: Date): Promise<ContributionRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsContributions)
      .where(
        and(
          gte(paymentsContributions.createdAt, from),
          sql`${paymentsContributions.createdAt} <= ${to}`,
        ),
      );
    return rows.map(toContribution);
  }

  async fundedProjectIds(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ projectId: paymentsLedgerEntries.projectId })
      .from(paymentsLedgerEntries);
    return rows.map((row) => row.projectId);
  }

  async publicSupporters(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ContributionRecord[]> {
    const table = paymentsContributions;
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          eq(table.projectId, projectId),
          eq(table.publicDisplay, true),
          eq(table.anonymous, false),
          inArray(table.status, ['succeeded', 'partially_refunded', 'disputed', 'dispute_won']),
          before(sql`(${table.succeededAt}, ${table.id})`, after),
        ),
      )
      .orderBy(desc(table.succeededAt), desc(table.id))
      .limit(limit);
    return rows.map(toContribution);
  }

  async statistics(): Promise<{
    succeeded: number;
    collectedEurMinor: bigint;
    kycPending: number;
    offlinePending: number;
  }> {
    const paid = ['succeeded', 'partially_refunded', 'disputed', 'dispute_won'];
    const [contributions] = await this.db
      .select({
        succeeded: sql<number>`count(*)::int`,
        collected: sql<string>`coalesce(sum(${paymentsContributions.eurMinor} - ${paymentsContributions.refundedEurMinor} - ${paymentsContributions.lostEurMinor}), 0)::text`,
      })
      .from(paymentsContributions)
      .where(inArray(paymentsContributions.status, paid));
    const [kyc] = await this.db
      .select({ pending: sql<number>`count(*)::int` })
      .from(paymentsKycSubmissions)
      .where(eq(paymentsKycSubmissions.status, 'pending'));
    const [offline] = await this.db
      .select({ pending: sql<number>`count(*)::int` })
      .from(paymentsOfflineContributions)
      .where(eq(paymentsOfflineContributions.status, 'confirmed'));
    return {
      succeeded: contributions?.succeeded ?? 0,
      collectedEurMinor: BigInt(contributions?.collected ?? '0'),
      kycPending: kyc?.pending ?? 0,
      offlinePending: offline?.pending ?? 0,
    };
  }

  async refundableIdsOf(projectId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: paymentsContributions.id })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.projectId, projectId),
          inArray(paymentsContributions.status, ['succeeded', 'partially_refunded', 'dispute_won']),
        ),
      )
      .orderBy(paymentsContributions.id);
    return rows.map((row) => row.id);
  }

  async contributorIdsOf(projectId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ contributorId: paymentsContributions.contributorId })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.projectId, projectId),
          inArray(paymentsContributions.status, [
            'succeeded',
            'partially_refunded',
            'disputed',
            'dispute_won',
          ]),
        ),
      );
    return rows.map((row) => row.contributorId);
  }

  async countPaidContributions(projectId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.projectId, projectId),
          inArray(paymentsContributions.status, [
            'succeeded',
            'partially_refunded',
            'disputed',
            'dispute_won',
          ]),
        ),
      );
    return row?.count ?? 0;
  }

  async projectsSupportedBy(organizationId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ projectId: paymentsContributions.projectId })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.organizationId, organizationId),
          inArray(paymentsContributions.status, PAID_STATUSES),
        ),
      );
    return rows.map((row) => row.projectId);
  }

  async allContributions(afterId: string | null, limit: number): Promise<ContributionRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsContributions)
      .where(afterId ? gt(paymentsContributions.id, afterId) : undefined)
      .orderBy(asc(paymentsContributions.id))
      .limit(limit);
    return rows.map(toContribution);
  }

  async insertRefund(refund: RefundRecord): Promise<void> {
    await this.db.insert(paymentsRefunds).values(refund);
  }

  async findRefund(id: string): Promise<RefundRecord | null> {
    const [row] = await this.db.select().from(paymentsRefunds).where(eq(paymentsRefunds.id, id));
    return row ? toRefund(row) : null;
  }

  async findRefundByProviderId(providerRefundId: string): Promise<RefundRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsRefunds)
      .where(eq(paymentsRefunds.providerRefundId, providerRefundId));
    return row ? toRefund(row) : null;
  }

  async updateRefund(id: string, patch: Partial<RefundRecord>): Promise<void> {
    await this.db.update(paymentsRefunds).set(patch).where(eq(paymentsRefunds.id, id));
  }

  async refundsOf(contributionId: string): Promise<RefundRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsRefunds)
      .where(eq(paymentsRefunds.contributionId, contributionId))
      .orderBy(asc(paymentsRefunds.createdAt), asc(paymentsRefunds.id));
    return rows.map(toRefund);
  }

  async insertDispute(dispute: DisputeRecord): Promise<void> {
    await this.db.insert(paymentsDisputes).values(dispute);
  }

  async findDisputeByProviderId(providerDisputeId: string): Promise<DisputeRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsDisputes)
      .where(eq(paymentsDisputes.providerDisputeId, providerDisputeId));
    return row ? toDispute(row) : null;
  }

  async updateDispute(id: string, patch: Partial<DisputeRecord>): Promise<void> {
    await this.db.update(paymentsDisputes).set(patch).where(eq(paymentsDisputes.id, id));
  }

  async insertLedgerEntry(entry: LedgerEntryRecord): Promise<boolean> {
    const { lines, ...header } = entry;
    const inserted = await this.db
      .insert(paymentsLedgerEntries)
      .values(header)
      .onConflictDoNothing({ target: [paymentsLedgerEntries.kind, paymentsLedgerEntries.sourceId] })
      .returning({ id: paymentsLedgerEntries.id });
    if (inserted.length === 0) return false;
    if (lines.length > 0) {
      await this.db
        .insert(paymentsLedgerLines)
        .values(lines.map((line) => ({ id: this.ids.next(), entryId: entry.id, ...line })));
    }
    return true;
  }

  async findLedgerEntry(kind: LedgerKind, sourceId: string): Promise<LedgerEntryRecord | null> {
    const [header] = await this.db
      .select()
      .from(paymentsLedgerEntries)
      .where(
        and(eq(paymentsLedgerEntries.kind, kind), eq(paymentsLedgerEntries.sourceId, sourceId)),
      );
    if (!header) return null;
    const lines = await this.db
      .select()
      .from(paymentsLedgerLines)
      .where(eq(paymentsLedgerLines.entryId, header.id));
    return {
      ...header,
      kind: header.kind as LedgerKind,
      lines: lines.map((line) => ({
        account: line.account as LedgerAccount,
        currency: line.currency,
        amountMinor: line.amountMinor,
      })),
    };
  }

  async ledgerSum(
    account: string,
    scope: { contributionId?: string; projectId?: string; offlineContributionId?: string },
  ): Promise<Map<string, bigint>> {
    const rows = await this.db
      .select({
        currency: paymentsLedgerLines.currency,
        sum: sql<string>`coalesce(sum(${paymentsLedgerLines.amountMinor}), 0)::text`,
      })
      .from(paymentsLedgerLines)
      .innerJoin(paymentsLedgerEntries, eq(paymentsLedgerEntries.id, paymentsLedgerLines.entryId))
      .where(
        and(
          eq(paymentsLedgerLines.account, account),
          scope.contributionId
            ? eq(paymentsLedgerEntries.contributionId, scope.contributionId)
            : undefined,
          scope.projectId ? eq(paymentsLedgerEntries.projectId, scope.projectId) : undefined,
          scope.offlineContributionId
            ? eq(paymentsLedgerEntries.offlineContributionId, scope.offlineContributionId)
            : undefined,
        ),
      )
      .groupBy(paymentsLedgerLines.currency);
    return new Map(rows.map((row) => [row.currency, BigInt(row.sum)]));
  }

  async ledgerBalances(): Promise<Map<string, bigint>> {
    const rows = await this.db
      .select({
        currency: paymentsLedgerLines.currency,
        sum: sql<string>`coalesce(sum(${paymentsLedgerLines.amountMinor}), 0)::text`,
      })
      .from(paymentsLedgerLines)
      .groupBy(paymentsLedgerLines.currency);
    return new Map(rows.map((row) => [row.currency, BigInt(row.sum)]));
  }

  async findPayoutAccount(userId: string): Promise<PayoutAccountRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsPayoutAccounts)
      .where(eq(paymentsPayoutAccounts.userId, userId));
    return row ? toPayout(row) : null;
  }

  async findPayoutAccountByProviderId(
    provider: ProviderId,
    providerAccountId: string,
  ): Promise<PayoutAccountRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsPayoutAccounts)
      .where(
        and(
          eq(paymentsPayoutAccounts.provider, provider),
          eq(paymentsPayoutAccounts.providerAccountId, providerAccountId),
        ),
      );
    return row ? toPayout(row) : null;
  }

  async insertPayoutAccount(account: PayoutAccountRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(paymentsPayoutAccounts)
      .values(account)
      .onConflictDoNothing()
      .returning({ userId: paymentsPayoutAccounts.userId });
    return inserted.length > 0;
  }

  async updatePayoutAccount(userId: string, patch: Partial<PayoutAccountRecord>): Promise<void> {
    await this.db
      .update(paymentsPayoutAccounts)
      .set(patch)
      .where(eq(paymentsPayoutAccounts.userId, userId));
  }

  async replacePayoutAccount(
    previousProviderAccountId: string,
    account: PayoutAccountRecord,
  ): Promise<boolean> {
    const replaced = await this.db
      .update(paymentsPayoutAccounts)
      .set(account)
      .where(
        and(
          eq(paymentsPayoutAccounts.userId, account.userId),
          eq(paymentsPayoutAccounts.providerAccountId, previousProviderAccountId),
        ),
      )
      .returning({ userId: paymentsPayoutAccounts.userId });
    return replaced.length > 0;
  }

  async hasPendingContributions(provider: ProviderId, providerAccountId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: paymentsContributions.id })
      .from(paymentsContributions)
      .where(
        and(
          eq(paymentsContributions.provider, provider),
          eq(paymentsContributions.providerAccountId, providerAccountId),
          eq(paymentsContributions.status, 'pending_payment'),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async payoutAccountsOf(provider: ProviderId): Promise<PayoutAccountRecord[]> {
    const rows = await this.db
      .select()
      .from(paymentsPayoutAccounts)
      .where(eq(paymentsPayoutAccounts.provider, provider));
    return rows.map(toPayout);
  }

  async insertKycSubmission(submission: KycSubmissionRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(paymentsKycSubmissions)
      .values(submission)
      .onConflictDoNothing()
      .returning({ id: paymentsKycSubmissions.id });
    return inserted.length > 0;
  }

  async findKycSubmission(id: string): Promise<KycSubmissionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsKycSubmissions)
      .where(eq(paymentsKycSubmissions.id, id));
    return row ? toKyc(row) : null;
  }

  async latestKycSubmission(userId: string): Promise<KycSubmissionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsKycSubmissions)
      .where(eq(paymentsKycSubmissions.userId, userId))
      .orderBy(desc(paymentsKycSubmissions.submittedAt), desc(paymentsKycSubmissions.id))
      .limit(1);
    return row ? toKyc(row) : null;
  }

  async updateKycSubmission(id: string, patch: Partial<KycSubmissionRecord>): Promise<void> {
    await this.db
      .update(paymentsKycSubmissions)
      .set(patch)
      .where(eq(paymentsKycSubmissions.id, id));
  }

  async kycSubmissions(
    status: KycSubmissionRecord['status'] | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<KycSubmissionRecord[]> {
    const table = paymentsKycSubmissions;
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          status ? eq(table.status, status) : undefined,
          before(sql`(${table.submittedAt}, ${table.id})`, after),
        ),
      )
      .orderBy(desc(table.submittedAt), desc(table.id))
      .limit(limit);
    return rows.map(toKyc);
  }

  async insertOffline(record: OfflineContributionRecord): Promise<void> {
    await this.db.insert(paymentsOfflineContributions).values(record);
  }

  async findOffline(id: string): Promise<OfflineContributionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsOfflineContributions)
      .where(eq(paymentsOfflineContributions.id, id));
    return row ? toOffline(row) : null;
  }

  async lockOffline(id: string): Promise<OfflineContributionRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsOfflineContributions)
      .where(eq(paymentsOfflineContributions.id, id))
      .for('update');
    return row ? toOffline(row) : null;
  }

  async updateOffline(id: string, patch: Partial<OfflineContributionRecord>): Promise<void> {
    await this.db
      .update(paymentsOfflineContributions)
      .set(patch)
      .where(eq(paymentsOfflineContributions.id, id));
  }

  async offlineContributions(
    filter: { projectId?: string; contributorId?: string; status?: OfflineContributionStatus },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<OfflineContributionRecord[]> {
    const table = paymentsOfflineContributions;
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          filter.projectId ? eq(table.projectId, filter.projectId) : undefined,
          filter.contributorId ? eq(table.contributorId, filter.contributorId) : undefined,
          filter.status ? eq(table.status, filter.status) : undefined,
          before(sql`(${table.createdAt}, ${table.id})`, after),
        ),
      )
      .orderBy(desc(table.createdAt), desc(table.id))
      .limit(limit);
    return rows.map(toOffline);
  }

  async countCommitments(projectId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentsOfflineContributions)
      .where(
        and(
          eq(paymentsOfflineContributions.projectId, projectId),
          eq(paymentsOfflineContributions.kind, 'love_money_commitment'),
          eq(paymentsOfflineContributions.status, 'confirmed'),
        ),
      );
    return row?.count ?? 0;
  }

  async insertProviderEvent(event: {
    id: string;
    provider: ProviderId;
    externalId: string;
    type: string;
    contributionId: string | null;
    providerAccountId: string | null;
    receivedAt: Date;
  }): Promise<boolean> {
    const inserted = await this.db
      .insert(paymentsProviderEvents)
      .values(event)
      .onConflictDoNothing()
      .returning({ id: paymentsProviderEvents.id });
    return inserted.length > 0;
  }

  async insertReconciliationRun(run: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    startedAt: Date;
  }): Promise<void> {
    await this.db
      .insert(paymentsReconciliationRuns)
      .values({ ...run, checkedTransactions: 0, discrepancies: 0 });
  }

  async finishReconciliationRun(
    id: string,
    finishedAt: Date,
    checkedTransactions: number,
    discrepancies: number,
  ): Promise<void> {
    await this.db
      .update(paymentsReconciliationRuns)
      .set({ finishedAt, checkedTransactions, discrepancies })
      .where(eq(paymentsReconciliationRuns.id, id));
  }

  async insertDiscrepancy(discrepancy: DiscrepancyRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(paymentsDiscrepancies)
      .values(discrepancy)
      .onConflictDoNothing()
      .returning({ id: paymentsDiscrepancies.id });
    return inserted.length > 0;
  }

  async findDiscrepancy(id: string): Promise<DiscrepancyRecord | null> {
    const [row] = await this.db
      .select()
      .from(paymentsDiscrepancies)
      .where(eq(paymentsDiscrepancies.id, id));
    return row ? toDiscrepancy(row) : null;
  }

  async updateDiscrepancy(id: string, patch: Partial<DiscrepancyRecord>): Promise<void> {
    await this.db.update(paymentsDiscrepancies).set(patch).where(eq(paymentsDiscrepancies.id, id));
  }

  async discrepancies(
    status: DiscrepancyRecord['status'] | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<DiscrepancyRecord[]> {
    const table = paymentsDiscrepancies;
    const rows = await this.db
      .select()
      .from(table)
      .where(
        and(
          status ? eq(table.status, status) : undefined,
          before(sql`(${table.detectedAt}, ${table.id})`, after),
        ),
      )
      .orderBy(desc(table.detectedAt), desc(table.id))
      .limit(limit);
    return rows.map(toDiscrepancy);
  }
}
