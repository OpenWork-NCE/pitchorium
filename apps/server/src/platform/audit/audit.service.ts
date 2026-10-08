import { Injectable } from '@nestjs/common';
import { auditLog } from '@pitchorium/db';
import { and, desc, eq, gte, lte, sql } from '@pitchorium/db/orm';
import { replaceIdentifier } from '../compliance/personal-data-sql';
import { TransactionManager } from '../database';
import { Clock, IdGenerator } from '../kernel';

export interface AuditEntry {
  actor: { type: 'user' | 'system'; id?: string };
  /** `<module>.<verb>`, for example `projects.campaign-published`. */
  action: string;
  target: { type: string; id: string };
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export interface AuditFilter {
  actorId?: string | undefined;
  action?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export interface AuditRecord {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  occurredAt: Date;
}

/** Writes to platform.audit_log, inside the current transaction when there is one. */
@Injectable()
export class AuditService {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Erasure of a member (GDPR): the log stays as evidence, their identifier and email are
   * replaced by the pseudonym of the erasure.
   */
  async pseudonymize(userId: string, email: string, pseudonym: string): Promise<void> {
    const db = this.transactions.executor;
    await replaceIdentifier(
      db,
      [
        { table: 'platform.audit_log', column: 'actor_id', kind: 'text' },
        { table: 'platform.audit_log', column: 'target_id', kind: 'text' },
        { table: 'platform.audit_log', column: 'metadata', kind: 'jsonb' },
      ],
      userId,
      pseudonym,
    );
    await replaceIdentifier(
      db,
      [{ table: 'platform.audit_log', column: 'metadata', kind: 'jsonb' }],
      email,
      pseudonym,
    );
  }

  async record(entry: AuditEntry): Promise<void> {
    await this.transactions.executor.insert(auditLog).values({
      id: this.ids.next(),
      actorType: entry.actor.type,
      actorId: entry.actor.id ?? null,
      action: entry.action,
      targetType: entry.target.type,
      targetId: entry.target.id,
      metadata: entry.metadata ?? {},
      requestId: entry.requestId ?? null,
      occurredAt: this.clock.now(),
    });
  }

  /** The log, newest first, filtered (administration). */
  async search(
    filter: AuditFilter,
    after: { at: Date; key: string } | null,
    limit: number,
  ): Promise<AuditRecord[]> {
    const rows = await this.transactions.executor
      .select()
      .from(auditLog)
      .where(
        and(
          filter.actorId ? eq(auditLog.actorId, filter.actorId) : undefined,
          filter.action ? eq(auditLog.action, filter.action) : undefined,
          filter.targetType ? eq(auditLog.targetType, filter.targetType) : undefined,
          filter.targetId ? eq(auditLog.targetId, filter.targetId) : undefined,
          filter.from ? gte(auditLog.occurredAt, filter.from) : undefined,
          filter.to ? lte(auditLog.occurredAt, filter.to) : undefined,
          after
            ? sql`(${auditLog.occurredAt}, ${auditLog.id}) < (${after.at}, ${after.key})`
            : undefined,
        ),
      )
      .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
      .limit(limit);
    return rows;
  }
}
