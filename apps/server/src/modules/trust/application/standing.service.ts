import { Injectable } from '@nestjs/common';
import type {
  Appeal,
  CursorPage,
  CursorPageQuery,
  ModerationDecision,
  ModerationStanding,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { assertAppealable } from '../domain/decisions';
import { DecisionAppealed } from '../domain/trust-events';
import type { AppealRecord, DecisionRecord } from '../domain/trust';
import { TrustRepository } from './ports';
import { SuspensionsService } from './suspensions.service';
import { TrustEventsRecorder } from './trust-events.recorder';
import { appealView, decisionView, suspensionView } from './trust-views';

const STANDING_DECISIONS = 20;

/**
 * What a member reads of their own moderation: the active suspension, the decisions that
 * concern them with their statement of reasons, and the appeal (internal complaint).
 */
@Injectable()
export class StandingService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly suspensions: SuspensionsService,
    private readonly events: TrustEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async standing(userId: string): Promise<ModerationStanding> {
    const [suspension, decisions] = await Promise.all([
      this.suspensions.active(userId),
      this.trust.decisionsOfSubject(userId, null, STANDING_DECISIONS),
    ]);
    return {
      suspension: suspension ? suspensionView(suspension) : null,
      decisions: await this.views(decisions),
    };
  }

  async decisions(userId: string, query: CursorPageQuery): Promise<CursorPage<ModerationDecision>> {
    const rows = await this.trust.decisionsOfSubject(
      userId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.views(page),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.decidedAt, key: last.id })
          : null,
    };
  }

  /** One appeal per decision, within the window, by the member concerned (resolver). */
  appeal(userId: string, decisionId: string, statement: string): Promise<Appeal> {
    return this.transactions.run(async () => {
      const decision = await this.trust.findDecision(decisionId);
      if (!decision || decision.subjectId !== userId) {
        throw new DomainError('TRUST_DECISION_NOT_FOUND', 'Decision not found');
      }
      const now = this.clock.now();
      assertAppealable(decision, await this.trust.appealOf(decisionId), now);
      const record: AppealRecord = {
        id: this.ids.next(),
        decisionId,
        appellantId: userId,
        statement,
        status: 'pending',
        reviewerId: null,
        outcomeStatement: null,
        createdAt: now,
        resolvedAt: null,
      };
      await this.trust.insertAppeal(record);
      await this.events.record(DecisionAppealed, decisionId, {
        appealId: record.id,
        appellantId: userId,
      });
      await this.audit.record({
        actor: { type: 'user', id: userId },
        action: 'trust.decision-appealed',
        target: { type: 'moderation_decision', id: decisionId },
        metadata: { appealId: record.id },
      });
      return appealView(record);
    });
  }

  private async views(decisions: readonly DecisionRecord[]): Promise<ModerationDecision[]> {
    const appeals = await this.trust.appealsOf(decisions.map((decision) => decision.id));
    return decisions.map((decision) => decisionView(decision, appeals.get(decision.id) ?? null));
  }
}
