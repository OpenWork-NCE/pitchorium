import { Injectable } from '@nestjs/common';
import type { TimeEntryKind, TimeEntryStatus } from '@pitchorium/contracts';
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from '@pitchorium/db/orm';
import {
  engagementContributionFacts,
  engagementTimeEntries,
} from '@pitchorium/db/schemas/engagement';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import type { ContributionFacts } from '../../payments';
import { type ContributionTotals, EngagementRepository, type GiverRef } from '../application/ports';
import type { TimeEntryRecord } from '../domain/time-entry';

const facts = engagementContributionFacts;
const entries = engagementTimeEntries;

const toEntry = (row: typeof entries.$inferSelect): TimeEntryRecord => ({
  ...row,
  kind: row.kind as TimeEntryKind,
  status: row.status as TimeEntryStatus,
});

/** Contributions of a member in their own name, or of an organization. */
function giverFilter(giver: GiverRef): SQL | undefined {
  return giver.type === 'member'
    ? and(eq(facts.contributorId, giver.id), isNull(facts.organizationId))
    : eq(facts.organizationId, giver.id);
}

@Injectable()
export class DrizzleEngagementRepository extends EngagementRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async upsertFacts(row: ContributionFacts, now: Date): Promise<void> {
    const values = {
      contributionId: row.contributionId,
      contributorId: row.contributorId,
      organizationId: row.organizationId,
      projectId: row.projectId,
      status: row.status,
      netEurMinor: row.netEurMinor,
      succeededAt: row.succeededAt,
      updatedAt: now,
    };
    await this.db
      .insert(facts)
      .values(values)
      .onConflictDoUpdate({
        target: facts.contributionId,
        set: {
          status: values.status,
          netEurMinor: values.netEurMinor,
          succeededAt: values.succeededAt,
          updatedAt: now,
        },
      });
  }

  async deleteAllFacts(): Promise<void> {
    await this.db.delete(facts);
  }

  async totals(giver: GiverRef, monthStart: Date): Promise<ContributionTotals> {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${facts.netEurMinor}), 0)::text`,
        month: sql<string>`coalesce(sum(${facts.netEurMinor}) filter (where ${facts.succeededAt} >= ${monthStart}), 0)::text`,
        projects: sql<number>`count(distinct ${facts.projectId}) filter (where ${facts.netEurMinor} > 0)::int`,
      })
      .from(facts)
      .where(giverFilter(giver));
    return {
      givenEurMinor: BigInt(row?.total ?? '0'),
      givenThisMonthEurMinor: BigInt(row?.month ?? '0'),
      projectsSupported: row?.projects ?? 0,
    };
  }

  async factsOf(giver: GiverRef) {
    const rows = await this.db
      .select()
      .from(facts)
      .where(and(giverFilter(giver), sql`${facts.succeededAt} is not null`))
      .orderBy(desc(facts.succeededAt));
    return rows;
  }

  async insertTimeEntry(entry: TimeEntryRecord): Promise<void> {
    await this.db.insert(entries).values(entry);
  }

  async findTimeEntry(id: string): Promise<TimeEntryRecord | null> {
    const [row] = await this.db.select().from(entries).where(eq(entries.id, id));
    return row ? toEntry(row) : null;
  }

  async lockTimeEntry(id: string): Promise<TimeEntryRecord | null> {
    const [row] = await this.db.select().from(entries).where(eq(entries.id, id)).for('update');
    return row ? toEntry(row) : null;
  }

  async updateTimeEntry(id: string, patch: Partial<TimeEntryRecord>): Promise<void> {
    await this.db.update(entries).set(patch).where(eq(entries.id, id));
  }

  async timeEntries(
    filter: {
      contributorId?: string;
      entrepreneurId?: string;
      projectIds?: readonly string[];
      status?: TimeEntryStatus;
    },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<TimeEntryRecord[]> {
    const received =
      filter.entrepreneurId !== undefined || filter.projectIds !== undefined
        ? or(
            filter.entrepreneurId ? eq(entries.entrepreneurId, filter.entrepreneurId) : undefined,
            filter.projectIds && filter.projectIds.length > 0
              ? inArray(entries.projectId, [...filter.projectIds])
              : undefined,
          )
        : undefined;
    const rows = await this.db
      .select()
      .from(entries)
      .where(
        and(
          filter.contributorId ? eq(entries.contributorId, filter.contributorId) : undefined,
          received,
          filter.status ? eq(entries.status, filter.status) : undefined,
          after
            ? sql`(${entries.createdAt}, ${entries.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(entries.createdAt), desc(entries.id))
      .limit(limit);
    return rows.map(toEntry);
  }

  async minutesByStatus(contributorId: string): Promise<Record<TimeEntryStatus, number>> {
    const rows = await this.db
      .select({
        status: entries.status,
        minutes: sql<number>`coalesce(sum(${entries.minutes}), 0)::int`,
      })
      .from(entries)
      .where(eq(entries.contributorId, contributorId))
      .groupBy(entries.status);
    const totals: Record<TimeEntryStatus, number> = { declared: 0, confirmed: 0, disputed: 0 };
    for (const row of rows) totals[row.status as TimeEntryStatus] = row.minutes;
    return totals;
  }
}
