import { Injectable } from '@nestjs/common';
import { auditLog } from '@pitchorium/db';
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
