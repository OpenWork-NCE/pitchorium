import { Injectable } from '@nestjs/common';
import type {
  AppealStatus,
  Locale,
  ModerationCaseOrigin,
  ModerationCaseStatus,
  ModerationDecisionKind,
  ModerationGround,
  ReportOutcome,
  ReportReason,
  ReportTargetType,
  TrustSignalKind,
} from '@pitchorium/contracts';
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from '@pitchorium/db/orm';
import {
  trustActivity,
  trustAppeals,
  trustAssignments,
  trustCases,
  trustDecisions,
  trustReports,
  trustSuspensions,
} from '@pitchorium/db/schemas/trust';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import {
  type QueueFilter,
  type QueuePosition,
  type TransparencyCounts,
  TrustRepository,
} from '../application/ports';
import type {
  AppealRecord,
  AssignmentRecord,
  CaseRecord,
  DecisionRecord,
  ReportRecord,
  SuspensionRecord,
} from '../domain/trust';

const toCase = (row: typeof trustCases.$inferSelect): CaseRecord => ({
  ...row,
  targetType: row.targetType as ReportTargetType,
  origin: row.origin as ModerationCaseOrigin,
  signalKind: row.signalKind as TrustSignalKind | null,
  status: row.status as ModerationCaseStatus,
  reasons: row.reasons as ReportReason[],
});

const toReport = (row: typeof trustReports.$inferSelect): ReportRecord => ({
  ...row,
  targetType: row.targetType as ReportTargetType,
  reason: row.reason as ReportReason,
  reporterLocale: row.reporterLocale as Locale | null,
  messageContext: row.messageContext ?? null,
  outcome: row.outcome as ReportOutcome | null,
});

const toDecision = (row: typeof trustDecisions.$inferSelect): DecisionRecord => ({
  ...row,
  targetType: row.targetType as ReportTargetType,
  kind: row.kind as ModerationDecisionKind,
  reason: row.reason as ReportReason | null,
  ground: row.ground as ModerationGround,
});

const toAppeal = (row: typeof trustAppeals.$inferSelect): AppealRecord => ({
  ...row,
  status: row.status as AppealStatus,
});

const count = (rows: { key: string | null; total: number }[]): Record<string, number> =>
  Object.fromEntries(rows.map((row) => [row.key ?? 'unknown', Number(row.total)]));

@Injectable()
export class DrizzleTrustRepository extends TrustRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lockTarget(targetType: ReportTargetType, targetId: string): Promise<void> {
    const key = `trust:${targetType}:${targetId}`;
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async openCaseFor(targetType: ReportTargetType, targetId: string): Promise<CaseRecord | null> {
    const [row] = await this.db
      .select()
      .from(trustCases)
      .where(
        and(
          eq(trustCases.targetType, targetType),
          eq(trustCases.targetId, targetId),
          eq(trustCases.status, 'open'),
        ),
      );
    return row ? toCase(row) : null;
  }

  async insertCase(record: CaseRecord): Promise<void> {
    await this.db.insert(trustCases).values(record);
  }

  async findCase(id: string): Promise<CaseRecord | null> {
    const [row] = await this.db.select().from(trustCases).where(eq(trustCases.id, id));
    return row ? toCase(row) : null;
  }

  async lockCase(id: string): Promise<CaseRecord | null> {
    const [row] = await this.db
      .select()
      .from(trustCases)
      .where(eq(trustCases.id, id))
      .for('update');
    return row ? toCase(row) : null;
  }

  async updateCase(id: string, patch: Partial<CaseRecord>): Promise<void> {
    await this.db.update(trustCases).set(patch).where(eq(trustCases.id, id));
  }

  async queue(
    filter: QueueFilter,
    after: QueuePosition | null,
    limit: number,
  ): Promise<CaseRecord[]> {
    const conditions = [eq(trustCases.status, filter.status)];
    if (filter.assignedTo === null) conditions.push(isNull(trustCases.assignedTo));
    else if (filter.assignedTo !== undefined) {
      conditions.push(eq(trustCases.assignedTo, filter.assignedTo));
    }
    if (filter.targetType) conditions.push(eq(trustCases.targetType, filter.targetType));
    if (after) {
      // Priority descending, then creation and id ascending.
      conditions.push(
        sql`(${trustCases.priority} < ${after.priority} or (${trustCases.priority} = ${after.priority} and (${trustCases.createdAt}, ${trustCases.id}) > (${after.createdAt}, ${after.id})))`,
      );
    }
    const rows = await this.db
      .select()
      .from(trustCases)
      .where(and(...conditions))
      .orderBy(desc(trustCases.priority), asc(trustCases.createdAt), asc(trustCases.id))
      .limit(limit);
    return rows.map(toCase);
  }

  async insertReport(record: ReportRecord): Promise<void> {
    await this.db.insert(trustReports).values(record);
  }

  async findReport(id: string): Promise<ReportRecord | null> {
    const [row] = await this.db.select().from(trustReports).where(eq(trustReports.id, id));
    return row ? toReport(row) : null;
  }

  async hasReported(caseId: string, reporterId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: trustReports.id })
      .from(trustReports)
      .where(and(eq(trustReports.caseId, caseId), eq(trustReports.reporterId, reporterId)));
    return row !== undefined;
  }

  async reportsOfCase(caseId: string): Promise<ReportRecord[]> {
    const rows = await this.db
      .select()
      .from(trustReports)
      .where(eq(trustReports.caseId, caseId))
      .orderBy(asc(trustReports.createdAt), asc(trustReports.id));
    return rows.map(toReport);
  }

  async reportsBy(
    reporterId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ReportRecord[]> {
    const rows = await this.db
      .select()
      .from(trustReports)
      .where(
        and(
          eq(trustReports.reporterId, reporterId),
          after
            ? sql`(${trustReports.createdAt}, ${trustReports.id}) < (${after.at}, ${after.key})`
            : undefined,
        ),
      )
      .orderBy(desc(trustReports.createdAt), desc(trustReports.id))
      .limit(limit);
    return rows.map(toReport);
  }

  async resolveReports(caseId: string, outcome: ReportOutcome, at: Date): Promise<ReportRecord[]> {
    const rows = await this.db
      .update(trustReports)
      .set({ outcome, resolvedAt: at })
      .where(and(eq(trustReports.caseId, caseId), isNull(trustReports.resolvedAt)))
      .returning();
    return rows.map(toReport);
  }

  async countReportsAgainst(subjectId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(trustReports)
      .innerJoin(trustCases, eq(trustCases.id, trustReports.caseId))
      .where(and(eq(trustCases.subjectId, subjectId), gte(trustReports.createdAt, since)));
    return row?.total ?? 0;
  }

  async insertAssignment(record: AssignmentRecord): Promise<void> {
    await this.db.insert(trustAssignments).values(record);
  }

  async assignmentsOf(caseId: string): Promise<AssignmentRecord[]> {
    return this.db
      .select()
      .from(trustAssignments)
      .where(eq(trustAssignments.caseId, caseId))
      .orderBy(asc(trustAssignments.assignedAt), asc(trustAssignments.id));
  }

  async insertDecision(record: DecisionRecord): Promise<void> {
    await this.db.insert(trustDecisions).values(record);
  }

  async findDecision(id: string): Promise<DecisionRecord | null> {
    const [row] = await this.db.select().from(trustDecisions).where(eq(trustDecisions.id, id));
    return row ? toDecision(row) : null;
  }

  async decisionsOfCase(caseId: string): Promise<DecisionRecord[]> {
    const rows = await this.db
      .select()
      .from(trustDecisions)
      .where(eq(trustDecisions.caseId, caseId))
      .orderBy(asc(trustDecisions.decidedAt));
    return rows.map(toDecision);
  }

  async decisionsOfSubject(
    subjectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<DecisionRecord[]> {
    const rows = await this.db
      .select()
      .from(trustDecisions)
      .where(
        and(
          eq(trustDecisions.subjectId, subjectId),
          after
            ? sql`(${trustDecisions.decidedAt}, ${trustDecisions.id}) < (${after.at}, ${after.key})`
            : undefined,
        ),
      )
      .orderBy(desc(trustDecisions.decidedAt), desc(trustDecisions.id))
      .limit(limit);
    return rows.map(toDecision);
  }

  async updateDecision(id: string, patch: Partial<DecisionRecord>): Promise<void> {
    await this.db.update(trustDecisions).set(patch).where(eq(trustDecisions.id, id));
  }

  async insertAppeal(record: AppealRecord): Promise<void> {
    await this.db.insert(trustAppeals).values(record);
  }

  async lockAppeal(id: string): Promise<AppealRecord | null> {
    const [row] = await this.db
      .select()
      .from(trustAppeals)
      .where(eq(trustAppeals.id, id))
      .for('update');
    return row ? toAppeal(row) : null;
  }

  async appealOf(decisionId: string): Promise<AppealRecord | null> {
    const [row] = await this.db
      .select()
      .from(trustAppeals)
      .where(eq(trustAppeals.decisionId, decisionId));
    return row ? toAppeal(row) : null;
  }

  async appealsOf(decisionIds: readonly string[]): Promise<Map<string, AppealRecord>> {
    if (decisionIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(trustAppeals)
      .where(inArray(trustAppeals.decisionId, [...decisionIds]));
    return new Map(rows.map((row) => [row.decisionId, toAppeal(row)]));
  }

  async updateAppeal(id: string, patch: Partial<AppealRecord>): Promise<void> {
    await this.db.update(trustAppeals).set(patch).where(eq(trustAppeals.id, id));
  }

  async pendingAppeals(after: KeysetPosition | null, limit: number): Promise<AppealRecord[]> {
    const rows = await this.db
      .select()
      .from(trustAppeals)
      .where(
        and(
          eq(trustAppeals.status, 'pending'),
          after
            ? sql`(${trustAppeals.createdAt}, ${trustAppeals.id}) > (${after.at}, ${after.key})`
            : undefined,
        ),
      )
      .orderBy(asc(trustAppeals.createdAt), asc(trustAppeals.id))
      .limit(limit);
    return rows.map(toAppeal);
  }

  async insertSuspension(record: SuspensionRecord): Promise<void> {
    await this.db.insert(trustSuspensions).values(record);
  }

  async findSuspension(id: string): Promise<SuspensionRecord | null> {
    const [row] = await this.db.select().from(trustSuspensions).where(eq(trustSuspensions.id, id));
    return row ?? null;
  }

  async suspensionOfDecision(decisionId: string): Promise<SuspensionRecord | null> {
    const [row] = await this.db
      .select()
      .from(trustSuspensions)
      .where(eq(trustSuspensions.decisionId, decisionId));
    return row ?? null;
  }

  async openSuspensionsOf(userId: string): Promise<SuspensionRecord[]> {
    return this.db
      .select()
      .from(trustSuspensions)
      .where(and(eq(trustSuspensions.userId, userId), isNull(trustSuspensions.endedAt)))
      .orderBy(desc(trustSuspensions.startsAt));
  }

  async updateSuspension(id: string, patch: Partial<SuspensionRecord>): Promise<void> {
    await this.db.update(trustSuspensions).set(patch).where(eq(trustSuspensions.id, id));
  }

  async expiredSuspensions(now: Date, limit: number): Promise<SuspensionRecord[]> {
    return this.db
      .select()
      .from(trustSuspensions)
      .where(and(isNull(trustSuspensions.endedAt), lte(trustSuspensions.endsAt, now)))
      .orderBy(asc(trustSuspensions.endsAt))
      .limit(limit);
  }

  async isSuspended(userId: string, now: Date): Promise<boolean> {
    const [row] = await this.db
      .select({ id: trustSuspensions.id })
      .from(trustSuspensions)
      .where(
        and(
          eq(trustSuspensions.userId, userId),
          isNull(trustSuspensions.endedAt),
          isNull(trustSuspensions.liftedAt),
          lte(trustSuspensions.startsAt, now),
          or(isNull(trustSuspensions.endsAt), sql`${trustSuspensions.endsAt} > ${now}`),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async recordActivity(row: {
    sourceEventId: string;
    userId: string;
    kind: TrustSignalKind;
    occurredAt: Date;
  }): Promise<boolean> {
    const inserted = await this.db
      .insert(trustActivity)
      .values(row)
      .onConflictDoNothing()
      .returning({ id: trustActivity.sourceEventId });
    return inserted.length > 0;
  }

  async countActivity(userId: string, kind: TrustSignalKind, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(trustActivity)
      .where(
        and(
          eq(trustActivity.userId, userId),
          eq(trustActivity.kind, kind),
          gte(trustActivity.occurredAt, since),
        ),
      );
    return row?.total ?? 0;
  }

  async purgeActivity(before: Date): Promise<number> {
    const rows = await this.db
      .delete(trustActivity)
      .where(lt(trustActivity.occurredAt, before))
      .returning({ id: trustActivity.sourceEventId });
    return rows.length;
  }

  async transparency(from: Date, to: Date): Promise<TransparencyCounts> {
    const inReports = and(gte(trustReports.createdAt, from), lt(trustReports.createdAt, to));
    const inCases = and(gte(trustCases.createdAt, from), lt(trustCases.createdAt, to));
    const inDecisions = and(gte(trustDecisions.decidedAt, from), lt(trustDecisions.decidedAt, to));
    const inAppeals = and(gte(trustAppeals.createdAt, from), lt(trustAppeals.createdAt, to));
    const total = sql<number>`count(*)::int`;
    const [reports] = await this.db
      .select({
        total,
        anonymous: sql<number>`count(*) filter (where ${trustReports.reporterId} is null)::int`,
      })
      .from(trustReports)
      .where(inReports);
    const byReason = await this.db
      .select({ key: trustReports.reason, total })
      .from(trustReports)
      .where(inReports)
      .groupBy(trustReports.reason);
    const byTargetType = await this.db
      .select({ key: trustReports.targetType, total })
      .from(trustReports)
      .where(inReports)
      .groupBy(trustReports.targetType);
    const [cases] = await this.db
      .select({
        opened: total,
        fromSignals: sql<number>`count(*) filter (where ${trustCases.origin} = 'signal')::int`,
      })
      .from(trustCases)
      .where(inCases);
    const resolved = await this.db
      .select({
        hours: sql<number>`extract(epoch from (${trustCases.resolvedAt} - ${trustCases.createdAt})) / 3600`,
      })
      .from(trustCases)
      .where(and(gte(trustCases.resolvedAt, from), lt(trustCases.resolvedAt, to)));
    const decisions = await this.db
      .select({ key: trustDecisions.kind, total })
      .from(trustDecisions)
      .where(inDecisions)
      .groupBy(trustDecisions.kind);
    const [suspensions] = await this.db
      .select({
        started: total,
        permanent: sql<number>`count(*) filter (where ${trustSuspensions.endsAt} is null)::int`,
      })
      .from(trustSuspensions)
      .where(and(gte(trustSuspensions.startsAt, from), lt(trustSuspensions.startsAt, to)));
    const appeals = await this.db
      .select({ key: trustAppeals.status, total })
      .from(trustAppeals)
      .where(inAppeals)
      .groupBy(trustAppeals.status);
    const appealCounts = count(appeals);
    return {
      reports: {
        total: reports?.total ?? 0,
        anonymous: reports?.anonymous ?? 0,
        byReason: count(byReason),
        byTargetType: count(byTargetType),
      },
      cases: {
        opened: cases?.opened ?? 0,
        fromSignals: cases?.fromSignals ?? 0,
        resolved: resolved.length,
        resolutionHours: resolved.map((row) => Number(row.hours)),
      },
      decisions: count(decisions),
      suspensions: { started: suspensions?.started ?? 0, permanent: suspensions?.permanent ?? 0 },
      appeals: {
        received: Object.values(appealCounts).reduce((sum, value) => sum + value, 0),
        upheld: appealCounts['upheld'] ?? 0,
        overturned: appealCounts['overturned'] ?? 0,
        pending: appealCounts['pending'] ?? 0,
      },
    };
  }
}
