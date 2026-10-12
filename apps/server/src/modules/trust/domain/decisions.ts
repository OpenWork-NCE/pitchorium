import {
  type Action,
  type AppealOutcome,
  type DecisionOptions,
  type ErrorCode,
  MODERATION_DECISION_KINDS,
  type ModerationDecisionKind,
  type ReportOutcome,
  type ReportTargetType,
  SUSPENSION_DAYS_MAX,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import type { AppealRecord, CaseRecord, DecisionRecord } from './trust';

/** Targets with a moderation status in their module: they can be hidden or removed. */
export const CONTENT_TARGETS: ReadonlySet<ReportTargetType> = new Set([
  'post',
  'comment',
  'project',
  'project_update',
  'event',
  'mission',
  'message',
  'media',
]);

export interface DecisionRequest {
  kind: ModerationDecisionKind;
  suspensionDays: number | null;
}

export interface DecisionContext {
  targetType: ReportTargetType;
  subjectId: string | null;
  actorIsAdmin: boolean;
  /** Longest suspension a moderator may decide (TRUST_MODERATOR_MAX_SUSPENSION_DAYS). */
  moderatorMaxSuspensionDays: number;
}

/** A decision reserved to administrators: permanent or long suspension, project freeze. */
export function requiresAdmin(
  request: DecisionRequest,
  moderatorMaxSuspensionDays: number,
): boolean {
  if (request.kind === 'freeze_project') return true;
  if (request.kind !== 'suspend') return false;
  return request.suspensionDays === null || request.suspensionDays > moderatorMaxSuspensionDays;
}

function notApplicable(message: string): DomainError {
  return new DomainError('TRUST_DECISION_NOT_APPLICABLE', message);
}

/** Why a kind of decision does not apply to the target, null when it does. */
function inapplicable(kind: ModerationDecisionKind, context: DecisionContext): string | null {
  switch (kind) {
    case 'dismiss':
      return null;
    case 'hide':
    case 'remove':
      return CONTENT_TARGETS.has(context.targetType)
        ? null
        : 'A profile or an organization is not hidden: warn or suspend';
    case 'warn':
    case 'suspend':
      return context.subjectId ? null : 'No member is concerned by this target';
    case 'freeze_project':
      return context.targetType === 'project' ? null : 'Only a project is frozen';
  }
}

/**
 * The second action a decision asserts on top of `trust.moderation.decide`: the freeze of a
 * project and a permanent suspension ask an administrator for a recent session.
 */
export function sensitiveDecisionAction(request: DecisionRequest): Action | null {
  if (request.kind === 'freeze_project') return 'trust.project.freeze';
  if (request.kind === 'suspend' && request.suspensionDays === null) {
    return 'trust.suspension.permanent';
  }
  return null;
}

/**
 * What the reader may decide on a case (the console offers nothing else): each kind with the
 * code it would fail with, and the bounds of a suspension. The same rules as a decision.
 */
export function decisionOptions(context: DecisionContext): DecisionOptions {
  const kinds = MODERATION_DECISION_KINDS.map((kind) => {
    let code: ErrorCode | null = inapplicable(kind, context)
      ? 'TRUST_DECISION_NOT_APPLICABLE'
      : null;
    if (!code && kind === 'freeze_project' && !context.actorIsAdmin) code = 'TRUST_ADMIN_REQUIRED';
    return {
      kind,
      allowed: code === null,
      code,
      recentAuthentication: kind === 'freeze_project',
    };
  });
  const suspendable = kinds.find((option) => option.kind === 'suspend')?.allowed ?? false;
  return {
    kinds,
    suspension: suspendable
      ? {
          maxDays: context.actorIsAdmin ? SUSPENSION_DAYS_MAX : context.moderatorMaxSuspensionDays,
          permanent: context.actorIsAdmin,
        }
      : null,
  };
}

/** Checks that the decision applies to the target and that the actor may take it. */
export function assertDecisionAllowed(request: DecisionRequest, context: DecisionContext): void {
  const refusal = inapplicable(request.kind, context);
  if (refusal) throw notApplicable(refusal);
  if (request.kind !== 'suspend' && request.suspensionDays !== null) {
    throw notApplicable('Suspension days apply to a suspension only');
  }
  if (requiresAdmin(request, context.moderatorMaxSuspensionDays) && !context.actorIsAdmin) {
    throw new DomainError('TRUST_ADMIN_REQUIRED', 'Decision reserved to administrators');
  }
}

export function assertCaseOpen(found: CaseRecord): void {
  if (found.status !== 'open') throw new DomainError('TRUST_CASE_RESOLVED', 'Case resolved');
}

/** What the reporters are told: an action was taken, or not. */
export function reportOutcomeOf(kind: ModerationDecisionKind): ReportOutcome {
  return kind === 'dismiss' ? 'no_action' : 'action_taken';
}

/**
 * A dismissal concerns no member and is not appealed by them; any other decision is
 * appealable once, within the window.
 */
export function appealableUntil(
  kind: ModerationDecisionKind,
  decidedAt: Date,
  windowMs: number,
): Date | null {
  return kind === 'dismiss' ? null : new Date(decidedAt.getTime() + windowMs);
}

export function suspensionEndsAt(decidedAt: Date, days: number | null): Date | null {
  return days === null ? null : new Date(decidedAt.getTime() + days * 86_400_000);
}

export function assertAppealable(
  decision: DecisionRecord,
  existing: AppealRecord | null,
  now: Date,
): void {
  if (existing) throw new DomainError('TRUST_APPEAL_EXISTS', 'Decision already appealed');
  if (!decision.appealableUntil || decision.appealableUntil <= now || decision.revertedAt) {
    throw new DomainError('TRUST_NOT_APPEALABLE', 'Decision cannot be appealed');
  }
}

/**
 * An appeal is pending until a moderator other than the author of the decision upholds or
 * overturns it; an overturned decision is reverted.
 */
/**
 * Why the reviewer may not resolve the appeal, null when they may: resolved already, or the
 * author of the decision (the internal complaint goes to another person, ADR 0072).
 */
export function appealReviewRefusal(
  appeal: AppealRecord,
  decision: DecisionRecord,
  reviewerId: string,
): 'TRUST_APPEAL_RESOLVED' | 'TRUST_SAME_MODERATOR' | null {
  if (appeal.status !== 'pending') return 'TRUST_APPEAL_RESOLVED';
  if (decision.decidedBy === reviewerId) return 'TRUST_SAME_MODERATOR';
  return null;
}

export function assertAppealReview(
  appeal: AppealRecord,
  decision: DecisionRecord,
  reviewerId: string,
): void {
  const refusal = appealReviewRefusal(appeal, decision, reviewerId);
  if (refusal === 'TRUST_APPEAL_RESOLVED') {
    throw new DomainError(refusal, 'Appeal already resolved');
  }
  if (refusal === 'TRUST_SAME_MODERATOR') {
    throw new DomainError(refusal, 'Reviewed by the author of the decision');
  }
}

export function revertsDecision(outcome: AppealOutcome): boolean {
  return outcome === 'overturned';
}
