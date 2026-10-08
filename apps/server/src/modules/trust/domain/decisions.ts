import type {
  AppealOutcome,
  ModerationDecisionKind,
  ReportOutcome,
  ReportTargetType,
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

/** Checks that the decision applies to the target and that the actor may take it. */
export function assertDecisionAllowed(request: DecisionRequest, context: DecisionContext): void {
  switch (request.kind) {
    case 'dismiss':
      break;
    case 'hide':
    case 'remove':
      if (!CONTENT_TARGETS.has(context.targetType)) {
        throw notApplicable('A profile or an organization is not hidden: warn or suspend');
      }
      break;
    case 'warn':
    case 'suspend':
      if (!context.subjectId) throw notApplicable('No member is concerned by this target');
      break;
    case 'freeze_project':
      if (context.targetType !== 'project') throw notApplicable('Only a project is frozen');
      break;
  }
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
export function assertAppealReview(
  appeal: AppealRecord,
  decision: DecisionRecord,
  reviewerId: string,
): void {
  if (appeal.status !== 'pending') {
    throw new DomainError('TRUST_APPEAL_RESOLVED', 'Appeal already resolved');
  }
  if (decision.decidedBy === reviewerId) {
    throw new DomainError('TRUST_SAME_MODERATOR', 'Reviewed by the author of the decision');
  }
}

export function revertsDecision(outcome: AppealOutcome): boolean {
  return outcome === 'overturned';
}
