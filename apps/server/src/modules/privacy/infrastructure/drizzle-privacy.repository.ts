import { Injectable } from '@nestjs/common';
import type { ErasureStatus, ExportStatus, Locale, RightsRequestKind } from '@pitchorium/contracts';
import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from '@pitchorium/db/orm';
import { privacyErasures, privacyExports } from '@pitchorium/db/schemas/privacy';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import { PrivacyRepository, type RightsRequestRow } from '../application/ports';
import type { ErasureRecord, ExportRecord } from '../domain/privacy';

const toExport = (row: typeof privacyExports.$inferSelect): ExportRecord => ({
  ...row,
  status: row.status as ExportStatus,
});

const toErasure = (row: typeof privacyErasures.$inferSelect): ErasureRecord => ({
  ...row,
  status: row.status as ErasureStatus,
  contact: row.contact
    ? { email: row.contact.email, name: row.contact.name, locale: row.contact.locale as Locale }
    : null,
});

const OPEN_ERASURES = ['scheduled', 'running', 'blocked'];

@Injectable()
export class DrizzlePrivacyRepository extends PrivacyRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async insertExport(record: ExportRecord): Promise<void> {
    await this.db.insert(privacyExports).values(record);
  }

  async findExport(id: string): Promise<ExportRecord | null> {
    const [row] = await this.db.select().from(privacyExports).where(eq(privacyExports.id, id));
    return row ? toExport(row) : null;
  }

  async latestExport(userId: string): Promise<ExportRecord | null> {
    return (await this.exportsOf(userId, 1))[0] ?? null;
  }

  async exportsOf(userId: string, limit: number): Promise<ExportRecord[]> {
    const rows = await this.db
      .select()
      .from(privacyExports)
      .where(eq(privacyExports.userId, userId))
      .orderBy(desc(privacyExports.requestedAt), desc(privacyExports.id))
      .limit(limit);
    return rows.map(toExport);
  }

  async updateExport(id: string, patch: Partial<ExportRecord>): Promise<void> {
    await this.db.update(privacyExports).set(patch).where(eq(privacyExports.id, id));
  }

  async expiredExports(now: Date, limit: number): Promise<ExportRecord[]> {
    const rows = await this.db
      .select()
      .from(privacyExports)
      .where(and(eq(privacyExports.status, 'ready'), lte(privacyExports.expiresAt, now)))
      .orderBy(asc(privacyExports.expiresAt))
      .limit(limit);
    return rows.map(toExport);
  }

  async deleteExportsOf(userId: string): Promise<ExportRecord[]> {
    const rows = await this.db
      .delete(privacyExports)
      .where(eq(privacyExports.userId, userId))
      .returning();
    return rows.map(toExport);
  }

  async insertErasure(record: ErasureRecord): Promise<void> {
    await this.db.insert(privacyErasures).values(record);
  }

  async findErasure(id: string): Promise<ErasureRecord | null> {
    const [row] = await this.db.select().from(privacyErasures).where(eq(privacyErasures.id, id));
    return row ? toErasure(row) : null;
  }

  async lockErasure(id: string): Promise<ErasureRecord | null> {
    const [row] = await this.db
      .select()
      .from(privacyErasures)
      .where(eq(privacyErasures.id, id))
      .for('update');
    return row ? toErasure(row) : null;
  }

  async openErasureOf(userId: string): Promise<ErasureRecord | null> {
    const [row] = await this.db
      .select()
      .from(privacyErasures)
      .where(
        and(eq(privacyErasures.userId, userId), inArray(privacyErasures.status, OPEN_ERASURES)),
      );
    return row ? toErasure(row) : null;
  }

  async latestErasureOf(userId: string): Promise<ErasureRecord | null> {
    const [row] = await this.db
      .select()
      .from(privacyErasures)
      .where(eq(privacyErasures.userId, userId))
      .orderBy(desc(privacyErasures.requestedAt))
      .limit(1);
    return row ? toErasure(row) : null;
  }

  async updateErasure(id: string, patch: Partial<ErasureRecord>): Promise<void> {
    await this.db.update(privacyErasures).set(patch).where(eq(privacyErasures.id, id));
  }

  async dueErasures(now: Date, limit: number): Promise<ErasureRecord[]> {
    const rows = await this.db
      .select()
      .from(privacyErasures)
      .where(
        or(
          and(
            inArray(privacyErasures.status, ['scheduled', 'blocked']),
            lte(privacyErasures.scheduledFor, now),
          ),
          eq(privacyErasures.status, 'running'),
        ),
      )
      .orderBy(asc(privacyErasures.scheduledFor))
      .limit(limit);
    return rows.map(toErasure);
  }

  async erasuresToRemind(before: Date, limit: number): Promise<ErasureRecord[]> {
    const rows = await this.db
      .select()
      .from(privacyErasures)
      .where(
        and(
          eq(privacyErasures.status, 'scheduled'),
          isNull(privacyErasures.remindedAt),
          lte(privacyErasures.scheduledFor, before),
        ),
      )
      .orderBy(asc(privacyErasures.scheduledFor))
      .limit(limit);
    return rows.map(toErasure);
  }

  async openRequests(): Promise<number> {
    const [exports] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(privacyExports)
      .where(eq(privacyExports.status, 'pending'));
    const [erasures] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(privacyErasures)
      .where(inArray(privacyErasures.status, ['scheduled', 'running', 'blocked', 'failed']));
    return (exports?.total ?? 0) + (erasures?.total ?? 0);
  }

  async rightsRequests(
    kind: RightsRequestKind | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<RightsRequestRow[]> {
    const exports = sql`select id, 'export' as kind, user_id, status, requested_at, completed_at, error as detail from privacy.exports`;
    const erasures = sql`select id, 'erasure' as kind, user_id, status, requested_at, completed_at, coalesce(blocked_by, array_to_string(residues, ', ')) as detail from privacy.erasures`;
    const union =
      kind === 'export'
        ? exports
        : kind === 'erasure'
          ? erasures
          : sql`${exports} union all ${erasures}`;
    const result = await this.db.execute<{
      id: string;
      kind: RightsRequestKind;
      user_id: string | null;
      status: string;
      requested_at: Date | string;
      completed_at: Date | string | null;
      detail: string | null;
    }>(sql`
      select * from (${union}) requests
      ${after ? sql`where (requested_at, id) < (${after.at}, ${after.key})` : sql``}
      order by requested_at desc, id desc
      limit ${limit}`);
    return result.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      userId: row.user_id,
      status: row.status,
      requestedAt: new Date(row.requested_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null,
      detail: row.detail,
    }));
  }
}
