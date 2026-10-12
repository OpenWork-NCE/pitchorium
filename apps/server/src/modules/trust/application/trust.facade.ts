import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  ModerationDecisionDetail,
  ModerationDecisionKind,
  ReportReason,
} from '@pitchorium/contracts';
import { AccessFacade } from '../../access';
import { TrustRepository } from './ports';
import { SuspensionsService } from './suspensions.service';
import { decisionDetailView } from './trust-views';

/** What the notifications need to tell the member concerned about a decision. */
export interface DecisionNotice {
  subjectId: string | null;
  kind: ModerationDecisionKind;
  reason: ReportReason | null;
  statement: string;
  appealableUntil: Date | null;
}

/**
 * Public facade of the trust module: the statement of a decision or an appeal for the
 * notifications, the standing of a member for the administration. At startup it gives access
 * the suspension of an account (`suspended` trust level).
 */
@Injectable()
export class TrustFacade implements OnModuleInit {
  constructor(
    private readonly trust: TrustRepository,
    private readonly suspensions: SuspensionsService,
    private readonly access: AccessFacade,
  ) {}

  onModuleInit(): void {
    this.access.registerAccountStatusSource({
      isSuspended: (userId) => this.suspensions.isSuspended(userId),
    });
  }

  async decisionNotice(decisionId: string): Promise<DecisionNotice | null> {
    const decision = await this.trust.findDecision(decisionId);
    return decision
      ? {
          subjectId: decision.subjectId,
          kind: decision.kind,
          reason: decision.reason,
          statement: decision.statement,
          appealableUntil: decision.appealableUntil,
        }
      : null;
  }

  /** Final statement of an appeal, null while it is pending. */
  async appealOutcome(decisionId: string): Promise<string | null> {
    return (await this.trust.appealOf(decisionId))?.outcomeStatement ?? null;
  }

  /** Open cases and pending appeals (administration statistics). */
  pendingCounts(): Promise<{ cases: number; appeals: number }> {
    return this.trust.pendingCounts();
  }

  /** Active suspension of a member: its end, null when permanent; undefined when none. */
  async activeSuspension(userId: string): Promise<{ id: string; endsAt: Date | null } | null> {
    const active = await this.suspensions.active(userId);
    return active ? { id: active.id, endsAt: active.endsAt } : null;
  }

  /**
   * The latest decisions concerning a member, with their appeal (file of a member in the
   * administration, whose reading the admin module audits).
   */
  async decisionsAbout(userId: string, limit: number): Promise<ModerationDecisionDetail[]> {
    const decisions = await this.trust.decisionsOfSubject(userId, null, limit);
    const appeals = await this.trust.appealsOf(decisions.map((decision) => decision.id));
    return decisions.map((decision) =>
      decisionDetailView(decision, appeals.get(decision.id) ?? null),
    );
  }
}
