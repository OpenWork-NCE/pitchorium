import type {
  Appeal,
  ModerationAssignment,
  ModerationCase,
  ModerationDecision,
  ModerationDecisionDetail,
  ModerationReport,
  Report,
  ReportedMessageContext,
  Suspension,
} from '@pitchorium/contracts';
import type {
  AppealRecord,
  AssignmentRecord,
  CaseRecord,
  DecisionRecord,
  ReportRecord,
  SuspensionRecord,
} from '../domain/trust';

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/** A report as its author sees it; a profile is shown by its current handle. */
export function reportView(record: ReportRecord, handles: ReadonlyMap<string, string>): Report {
  return {
    id: record.id,
    targetType: record.targetType,
    targetId:
      record.targetType === 'profile' ? (handles.get(record.targetId) ?? null) : record.targetId,
    reason: record.reason,
    status: record.resolvedAt ? 'resolved' : 'received',
    outcome: record.outcome,
    createdAt: record.createdAt.toISOString(),
    resolvedAt: iso(record.resolvedAt),
  };
}

export function moderationReportView(record: ReportRecord): ModerationReport {
  return {
    id: record.id,
    reason: record.reason,
    details: record.details,
    reporterId: record.reporterId,
    anonymous: record.reporterId === null,
    messageContext: (record.messageContext as ReportedMessageContext | null) ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function caseView(record: CaseRecord): ModerationCase {
  return {
    id: record.id,
    targetType: record.targetType,
    targetId: record.targetId,
    subjectId: record.subjectId,
    origin: record.origin,
    signalKind: record.signalKind,
    status: record.status,
    priority: record.priority,
    priorityReasons: record.priorityReasons,
    reportCount: record.reportCount,
    reasons: record.reasons,
    assignedTo: record.assignedTo,
    decisionId: record.decisionId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    resolvedAt: iso(record.resolvedAt),
  };
}

export function assignmentView(record: AssignmentRecord): ModerationAssignment {
  return {
    moderatorId: record.moderatorId,
    assignedBy: record.assignedBy,
    assignedAt: record.assignedAt.toISOString(),
  };
}

export function appealView(record: AppealRecord): Appeal {
  return {
    id: record.id,
    decisionId: record.decisionId,
    statement: record.statement,
    status: record.status,
    outcomeStatement: record.outcomeStatement,
    createdAt: record.createdAt.toISOString(),
    resolvedAt: iso(record.resolvedAt),
  };
}

/** The statement of reasons as the member concerned reads it. */
export function decisionView(
  record: DecisionRecord,
  appeal: AppealRecord | null,
): ModerationDecision {
  return {
    id: record.id,
    caseId: record.caseId,
    targetType: record.targetType,
    targetId: record.targetId,
    kind: record.kind,
    reason: record.reason,
    statement: record.statement,
    ground: record.ground,
    groundReference: record.groundReference,
    automatedDetection: record.automatedDetection,
    suspensionEndsAt: iso(record.suspensionEndsAt),
    decidedAt: record.decidedAt.toISOString(),
    appealableUntil: iso(record.appealableUntil),
    appeal: appeal ? appealView(appeal) : null,
  };
}

export function decisionDetailView(
  record: DecisionRecord,
  appeal: AppealRecord | null,
): ModerationDecisionDetail {
  return {
    ...decisionView(record, appeal),
    subjectId: record.subjectId,
    decidedBy: record.decidedBy,
    appealReviewerId: appeal?.reviewerId ?? null,
  };
}

export function suspensionView(record: SuspensionRecord): Suspension {
  return {
    id: record.id,
    userId: record.userId,
    decisionId: record.decisionId,
    startsAt: record.startsAt.toISOString(),
    endsAt: iso(record.endsAt),
    liftedAt: iso(record.liftedAt),
  };
}
