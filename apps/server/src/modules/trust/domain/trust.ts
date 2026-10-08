import type {
  AppealStatus,
  Locale,
  ModerationCaseOrigin,
  ModerationCaseStatus,
  ModerationDecisionKind,
  ModerationGround,
  ReportOutcome,
  ReportReason,
  ReportTargetType,
  TrustSignalKind,
} from '@pitchorium/contracts';

export interface CaseRecord {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  subjectId: string | null;
  origin: ModerationCaseOrigin;
  signalKind: TrustSignalKind | null;
  status: ModerationCaseStatus;
  priority: number;
  priorityReasons: string[];
  reportCount: number;
  reasons: ReportReason[];
  fundingActive: boolean;
  assignedTo: string | null;
  decisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface ReportRecord {
  id: string;
  caseId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterLocale: Locale | null;
  messageContext: Record<string, unknown> | null;
  outcome: ReportOutcome | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface AssignmentRecord {
  id: string;
  caseId: string;
  moderatorId: string | null;
  assignedBy: string;
  assignedAt: Date;
}

export interface DecisionRecord {
  id: string;
  caseId: string;
  targetType: ReportTargetType;
  targetId: string;
  subjectId: string | null;
  kind: ModerationDecisionKind;
  reason: ReportReason | null;
  statement: string;
  ground: ModerationGround;
  groundReference: string | null;
  automatedDetection: boolean;
  suspensionEndsAt: Date | null;
  decidedBy: string;
  decidedAt: Date;
  appealableUntil: Date | null;
  revertedAt: Date | null;
}

export interface AppealRecord {
  id: string;
  decisionId: string;
  appellantId: string;
  statement: string;
  status: AppealStatus;
  reviewerId: string | null;
  outcomeStatement: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface SuspensionRecord {
  id: string;
  userId: string;
  decisionId: string;
  startsAt: Date;
  /** Null for a permanent suspension. */
  endsAt: Date | null;
  liftedAt: Date | null;
  liftedBy: string | null;
  liftStatement: string | null;
  endedAt: Date | null;
}
