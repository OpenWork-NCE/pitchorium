import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ModerationDecisionKind, ReportReason } from '@pitchorium/contracts';
import { AccessFacade } from '../../access';
import { TrustRepository } from './ports';
import { SuspensionsService } from './suspensions.service';

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
}
