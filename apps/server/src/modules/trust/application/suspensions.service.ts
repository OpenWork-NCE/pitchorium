import { Injectable } from '@nestjs/common';
import type { Suspension } from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { isActive } from '../domain/suspension';
import { SuspensionEnded, SuspensionStarted } from '../domain/trust-events';
import type { DecisionRecord, SuspensionRecord } from '../domain/trust';
import { TrustRepository } from './ports';
import { TrustEventsRecorder } from './trust-events.recorder';
import { suspensionView } from './trust-views';

/**
 * Suspensions (§13): a suspended member signs in, reads the notice, appeals and exports their
 * data (actions `allowWhenSuspended` of access), and does nothing else; their sessions are
 * revoked when the suspension starts.
 */
@Injectable()
export class SuspensionsService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly identity: IdentityFacade,
    private readonly events: TrustEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Registered with access: checked at every authorization. */
  isSuspended(userId: string): Promise<boolean> {
    return this.trust.isSuspended(userId, this.clock.now());
  }

  async active(userId: string): Promise<SuspensionRecord | null> {
    const now = this.clock.now();
    return (await this.trust.openSuspensionsOf(userId)).find((item) => isActive(item, now)) ?? null;
  }

  /** Inside the transaction of the decision. */
  async start(decision: DecisionRecord, userId: string): Promise<SuspensionRecord> {
    const record: SuspensionRecord = {
      id: this.ids.next(),
      userId,
      decisionId: decision.id,
      startsAt: decision.decidedAt,
      endsAt: decision.suspensionEndsAt,
      liftedAt: null,
      liftedBy: null,
      liftStatement: null,
      endedAt: null,
    };
    await this.trust.insertSuspension(record);
    await this.events.record(SuspensionStarted, record.id, {
      userId,
      decisionId: decision.id,
      endsAt: record.endsAt?.toISOString() ?? null,
    });
    await this.identity.revokeAllSessions(userId, 'suspension');
    return record;
  }

  /** Early end by a moderator, with a statement. */
  lift(actorId: string, suspensionId: string, statement: string): Promise<Suspension> {
    return this.transactions.run(async () => {
      const found = await this.trust.findSuspension(suspensionId);
      if (!found || !isActive(found, this.clock.now())) {
        throw new DomainError('TRUST_SUSPENSION_NOT_FOUND', 'Suspension not found');
      }
      const ended = await this.end(found, 'lifted', actorId, statement);
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'trust.suspension-lifted',
        target: { type: 'user', id: found.userId },
        metadata: { suspensionId, decisionId: found.decisionId },
      });
      return suspensionView(ended);
    });
  }

  /** The decision was overturned on appeal: its suspension ends, inside that transaction. */
  async overturn(decisionId: string, reviewerId: string, statement: string): Promise<void> {
    const found = await this.trust.suspensionOfDecision(decisionId);
    if (found && found.endedAt === null) await this.end(found, 'overturned', reviewerId, statement);
  }

  /** Announces the suspensions over by their end date (scheduled task). */
  async endExpired(limit = 500): Promise<number> {
    const due = await this.trust.expiredSuspensions(this.clock.now(), limit);
    for (const item of due) {
      await this.transactions.run(async () => {
        await this.trust.updateSuspension(item.id, { endedAt: this.clock.now() });
        await this.events.record(SuspensionEnded, item.id, {
          userId: item.userId,
          decisionId: item.decisionId,
          cause: 'expired',
        });
      });
    }
    return due.length;
  }

  private async end(
    found: SuspensionRecord,
    cause: 'lifted' | 'overturned',
    actorId: string,
    statement: string,
  ): Promise<SuspensionRecord> {
    const now = this.clock.now();
    const patch = { liftedAt: now, liftedBy: actorId, liftStatement: statement, endedAt: now };
    await this.trust.updateSuspension(found.id, patch);
    await this.events.record(SuspensionEnded, found.id, {
      userId: found.userId,
      decisionId: found.decisionId,
      cause,
    });
    return { ...found, ...patch };
  }
}
