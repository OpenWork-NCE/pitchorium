import { Injectable } from '@nestjs/common';
import { auditLog } from '@pitchorium/db';
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
}
