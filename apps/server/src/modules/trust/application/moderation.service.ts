import { Inject, Injectable } from '@nestjs/common';
import type {
  CursorPage,
  CursorPageQuery,
  DecideModerationCaseRequest,
  ModerationCase,
  ModerationCaseDetail,
  ModerationDecisionDetail,
  ModerationQueueQuery,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeCursor,
  decodeKeyset,
  DomainError,
  encodeCursor,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { AccessFacade } from '../../access';
import { PaymentsFacade } from '../../payments';
import {
  appealableUntil,
  assertAppealReview,
  assertCaseOpen,
  assertDecisionAllowed,
  reportOutcomeOf,
  revertsDecision,
  suspensionEndsAt,
} from '../domain/decisions';
import {
  AppealResolved,
  DecisionTaken,
  ProjectRefundsRequested,
  ReportResolved,
} from '../domain/trust-events';
import type { CaseRecord, DecisionRecord } from '../domain/trust';
import { type QueuePosition, TrustRepository } from './ports';
import { SuspensionsService } from './suspensions.service';
import { TargetDirectory } from './target-directory';
import { TrustEventsRecorder } from './trust-events.recorder';
import { assignmentView, caseView, decisionDetailView, moderationReportView } from './trust-views';

const MODERATION_ROLES: readonly string[] = ['moderator', 'admin'];

function caseNotFound(): DomainError {
  return new DomainError('TRUST_CASE_NOT_FOUND', 'Moderation case not found');
}

/**
 * The moderation queue (§13): cases by priority, assignment with its history, decisions with
 * their statement of reasons applied to the target in its module, appeals reviewed by another
 * moderator. Every step is audited.
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly targets: TargetDirectory,
    private readonly suspensions: SuspensionsService,
    private readonly access: AccessFacade,
    private readonly payments: PaymentsFacade,
    private readonly events: TrustEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async queue(actorId: string, query: ModerationQueueQuery): Promise<CursorPage<ModerationCase>> {
    const after = query.cursor ? queuePosition(decodeCursor(query.cursor)) : null;
    const rows = await this.trust.queue(
      {
        status: query.status,
        ...(query.assigned === 'me' ? { assignedTo: actorId } : {}),
        ...(query.assigned === 'unassigned' ? { assignedTo: null } : {}),
        targetType: query.targetType,
      },
      after,
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(caseView),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({
              priority: String(last.priority),
              at: last.createdAt.toISOString(),
              key: last.id,
            })
          : null,
    };
  }

  /** The case with its reports, which hold personal data: the reading is audited. */
  async detail(actorId: string, caseId: string): Promise<ModerationCaseDetail> {
    const found = await this.trust.findCase(caseId);
    if (!found) throw caseNotFound();
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action: 'trust.case-viewed',
      target: { type: 'moderation_case', id: caseId },
    });
    return this.present(found);
  }

  async assign(
    actorId: string,
    caseId: string,
    moderatorId: string | null,
  ): Promise<ModerationCaseDetail> {
    if (moderatorId) {
      const roles = await this.access.rolesOf(moderatorId);
      if (!roles.some((role) => MODERATION_ROLES.includes(role))) {
        throw new DomainError('TRUST_ASSIGNEE_NOT_MODERATOR', 'Assignee is not a moderator');
      }
    }
    const updated = await this.transactions.run(async () => {
      const found = await this.trust.lockCase(caseId);
      if (!found) throw caseNotFound();
      assertCaseOpen(found);
      const now = this.clock.now();
      await this.trust.insertAssignment({
        id: this.ids.next(),
        caseId,
        moderatorId,
        assignedBy: actorId,
        assignedAt: now,
      });
      await this.trust.updateCase(caseId, { assignedTo: moderatorId, updatedAt: now });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'trust.case-assigned',
        target: { type: 'moderation_case', id: caseId },
        metadata: { moderatorId },
      });
      return { ...found, assignedTo: moderatorId, updatedAt: now };
    });
    return this.present(updated);
  }

  /**
   * Decides a case: the decision applies to the target in its module, the member concerned
   * receives the statement of reasons, the reporters are told the outcome.
   */
  async decide(
    actorId: string,
    caseId: string,
    request: DecideModerationCaseRequest,
  ): Promise<ModerationDecisionDetail> {
    const roles = await this.access.rolesOf(actorId);
    const decision = await this.transactions.run(async () => {
      const found = await this.trust.lockCase(caseId);
      if (!found) throw caseNotFound();
      assertCaseOpen(found);
      assertDecisionAllowed(request, {
        targetType: found.targetType,
        subjectId: found.subjectId,
        actorIsAdmin: roles.includes('admin'),
        moderatorMaxSuspensionDays: this.config.trust.moderatorMaxSuspensionDays,
      });
      const now = this.clock.now();
      const record: DecisionRecord = {
        id: this.ids.next(),
        caseId,
        targetType: found.targetType,
        targetId: found.targetId,
        subjectId: found.subjectId,
        kind: request.kind,
        reason: request.reason ?? found.reasons[0] ?? null,
        statement: request.statement,
        ground: request.ground,
        groundReference: request.groundReference,
        automatedDetection: found.origin === 'signal',
        suspensionEndsAt:
          request.kind === 'suspend' ? suspensionEndsAt(now, request.suspensionDays) : null,
        decidedBy: actorId,
        decidedAt: now,
        appealableUntil: appealableUntil(request.kind, now, this.config.trust.appealWindowMs),
        revertedAt: null,
      };
      await this.trust.insertDecision(record);
      await this.targets.apply(record.kind, record.targetType, record.targetId);
      if (record.kind === 'suspend' && record.subjectId) {
        await this.suspensions.start(record, record.subjectId);
      }
      await this.trust.updateCase(caseId, {
        status: 'resolved',
        decisionId: record.id,
        resolvedAt: now,
        updatedAt: now,
      });
      const outcome = reportOutcomeOf(record.kind);
      for (const report of await this.trust.resolveReports(caseId, outcome, now)) {
        await this.events.record(ReportResolved, report.id, {
          caseId,
          reporterId: report.reporterId,
          outcome,
        });
      }
      await this.events.record(DecisionTaken, record.id, {
        caseId,
        subjectId: record.subjectId,
        kind: record.kind,
        targetType: record.targetType,
        targetId: record.targetId,
      });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'trust.decision-taken',
        target: { type: record.targetType, id: record.targetId },
        metadata: {
          caseId,
          decisionId: record.id,
          kind: record.kind,
          subjectId: record.subjectId,
          suspensionEndsAt: record.suspensionEndsAt?.toISOString() ?? null,
        },
      });
      return record;
    });
    this.metrics.increment('pitchorium.trust.decision.taken', { kind: decision.kind });
    return decisionDetailView(decision, null);
  }

  /** Pending appeals, oldest first, with their decision. */
  async pendingAppeals(query: CursorPageQuery): Promise<CursorPage<ModerationDecisionDetail>> {
    const rows = await this.trust.pendingAppeals(decodeKeyset(query.cursor), query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const items: ModerationDecisionDetail[] = [];
    for (const appeal of page) {
      const decision = await this.trust.findDecision(appeal.decisionId);
      if (decision) items.push(decisionDetailView(decision, appeal));
    }
    return {
      items,
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  /**
   * Final decision on an appeal, by someone other than the author of the decision: upheld, or
   * overturned and its effects reverted.
   */
  async resolveAppeal(
    reviewerId: string,
    appealId: string,
    outcome: 'upheld' | 'overturned',
    statement: string,
  ): Promise<ModerationDecisionDetail> {
    const result = await this.transactions.run(async () => {
      const appeal = await this.trust.lockAppeal(appealId);
      if (!appeal) throw new DomainError('TRUST_APPEAL_NOT_FOUND', 'Appeal not found');
      const decision = await this.trust.findDecision(appeal.decisionId);
      if (!decision) throw new DomainError('TRUST_DECISION_NOT_FOUND', 'Decision not found');
      assertAppealReview(appeal, decision, reviewerId);
      const now = this.clock.now();
      const resolved = {
        ...appeal,
        status: outcome,
        reviewerId,
        outcomeStatement: statement,
        resolvedAt: now,
      } as const;
      await this.trust.updateAppeal(appealId, {
        status: outcome,
        reviewerId,
        outcomeStatement: statement,
        resolvedAt: now,
      });
      let current = decision;
      if (revertsDecision(outcome)) {
        await this.targets.apply(decision.kind, decision.targetType, decision.targetId, true);
        if (decision.kind === 'suspend') {
          await this.suspensions.overturn(decision.id, reviewerId, statement);
        }
        await this.trust.updateDecision(decision.id, { revertedAt: now });
        current = { ...decision, revertedAt: now };
      }
      await this.events.record(AppealResolved, decision.id, {
        appealId,
        appellantId: appeal.appellantId,
        outcome,
      });
      await this.audit.record({
        actor: { type: 'user', id: reviewerId },
        action: 'trust.appeal-resolved',
        target: { type: 'moderation_decision', id: decision.id },
        metadata: { appealId, outcome },
      });
      return decisionDetailView(current, resolved);
    });
    this.metrics.increment('pitchorium.trust.appeal.resolved', { outcome });
    return result;
  }

  /**
   * Refunds of the contributions of a frozen project (admins, §9 and §13), run one by one by
   * the worker through the payments module.
   */
  async refundFrozenProject(
    actorId: string,
    projectId: string,
    decisionId: string,
    reason: string,
  ): Promise<{ queued: number }> {
    const decision = await this.trust.findDecision(decisionId);
    if (
      !decision ||
      decision.kind !== 'freeze_project' ||
      decision.targetId !== projectId ||
      decision.revertedAt
    ) {
      throw new DomainError('TRUST_PROJECT_NOT_FROZEN', 'Project not frozen by this decision');
    }
    const contributions = await this.payments.refundableContributionIds(projectId);
    await this.transactions.run(async () => {
      await this.events.record(ProjectRefundsRequested, decisionId, {
        projectId,
        contributionIds: contributions,
        reason,
        requestedBy: actorId,
      });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'trust.project-refunds-requested',
        target: { type: 'project', id: projectId },
        metadata: { decisionId, contributions: contributions.length, reason },
      });
    });
    return { queued: contributions.length };
  }

  private async present(found: CaseRecord): Promise<ModerationCaseDetail> {
    const [reports, assignments, decisions] = await Promise.all([
      this.trust.reportsOfCase(found.id),
      this.trust.assignmentsOf(found.id),
      this.trust.decisionsOfCase(found.id),
    ]);
    const appeals = await this.trust.appealsOf(decisions.map((decision) => decision.id));
    return {
      ...caseView(found),
      reports: reports.map(moderationReportView),
      assignments: assignments.map(assignmentView),
      decisions: decisions.map((decision) =>
        decisionDetailView(decision, appeals.get(decision.id) ?? null),
      ),
    };
  }
}

function queuePosition(fields: Readonly<Record<string, string>>): QueuePosition {
  const priority = Number(fields['priority']);
  const createdAt = new Date(fields['at'] ?? '');
  const id = fields['key'];
  if (!Number.isInteger(priority) || Number.isNaN(createdAt.getTime()) || !id) {
    throw new DomainError('BAD_REQUEST', 'Invalid pagination cursor');
  }
  return { priority, createdAt, id };
}
