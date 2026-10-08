import type {
  ModerationCaseStatus,
  ReportOutcome,
  ReportTargetType,
  TrustSignalKind,
} from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type {
  AppealRecord,
  AssignmentRecord,
  CaseRecord,
  DecisionRecord,
  ReportRecord,
  SuspensionRecord,
} from '../domain/trust';

/** Position in the moderation queue: priority first, then the oldest. */
export interface QueuePosition {
  priority: number;
  createdAt: Date;
  id: string;
}

export interface QueueFilter {
  status: ModerationCaseStatus;
  /** Undefined: any; null: unassigned. */
  assignedTo?: string | null;
  targetType?: ReportTargetType | undefined;
}

/** Raw counters of the transparency report over a period. */
export interface TransparencyCounts {
  reports: {
    total: number;
    anonymous: number;
    byReason: Record<string, number>;
    byTargetType: Record<string, number>;
  };
  cases: { opened: number; fromSignals: number; resolved: number; resolutionHours: number[] };
  decisions: Record<string, number>;
  suspensions: { started: number; permanent: number };
  appeals: { received: number; upheld: number; overturned: number; pending: number };
}

export abstract class TrustRepository {
  /** Serializes the reports of one target (transaction-scoped advisory lock). */
  abstract lockTarget(targetType: ReportTargetType, targetId: string): Promise<void>;
  abstract openCaseFor(targetType: ReportTargetType, targetId: string): Promise<CaseRecord | null>;
  abstract insertCase(record: CaseRecord): Promise<void>;
  abstract findCase(id: string): Promise<CaseRecord | null>;
  abstract lockCase(id: string): Promise<CaseRecord | null>;
  abstract updateCase(id: string, patch: Partial<CaseRecord>): Promise<void>;
  abstract queue(
    filter: QueueFilter,
    after: QueuePosition | null,
    limit: number,
  ): Promise<CaseRecord[]>;

  abstract insertReport(record: ReportRecord): Promise<void>;
  abstract findReport(id: string): Promise<ReportRecord | null>;
  abstract hasReported(caseId: string, reporterId: string): Promise<boolean>;
  abstract reportsOfCase(caseId: string): Promise<ReportRecord[]>;
  abstract reportsBy(
    reporterId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ReportRecord[]>;
  /** Resolves the open reports of a case, returns them. */
  abstract resolveReports(
    caseId: string,
    outcome: ReportOutcome,
    at: Date,
  ): Promise<ReportRecord[]>;
  /** Reports received since the date by targets whose subject is the member. */
  abstract countReportsAgainst(subjectId: string, since: Date): Promise<number>;

  abstract insertAssignment(record: AssignmentRecord): Promise<void>;
  abstract assignmentsOf(caseId: string): Promise<AssignmentRecord[]>;

  abstract insertDecision(record: DecisionRecord): Promise<void>;
  abstract findDecision(id: string): Promise<DecisionRecord | null>;
  abstract decisionsOfCase(caseId: string): Promise<DecisionRecord[]>;
  abstract decisionsOfSubject(
    subjectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<DecisionRecord[]>;
  abstract updateDecision(id: string, patch: Partial<DecisionRecord>): Promise<void>;

  abstract insertAppeal(record: AppealRecord): Promise<void>;
  abstract lockAppeal(id: string): Promise<AppealRecord | null>;
  abstract appealOf(decisionId: string): Promise<AppealRecord | null>;
  abstract appealsOf(decisionIds: readonly string[]): Promise<Map<string, AppealRecord>>;
  abstract updateAppeal(id: string, patch: Partial<AppealRecord>): Promise<void>;
  /** Pending appeals, oldest first. */
  abstract pendingAppeals(after: KeysetPosition | null, limit: number): Promise<AppealRecord[]>;

  abstract insertSuspension(record: SuspensionRecord): Promise<void>;
  abstract findSuspension(id: string): Promise<SuspensionRecord | null>;
  abstract suspensionOfDecision(decisionId: string): Promise<SuspensionRecord | null>;
  /** Suspensions not yet announced as ended, latest first. */
  abstract openSuspensionsOf(userId: string): Promise<SuspensionRecord[]>;
  abstract updateSuspension(id: string, patch: Partial<SuspensionRecord>): Promise<void>;
  /** Suspensions over by their end date and not yet announced as ended. */
  abstract expiredSuspensions(now: Date, limit: number): Promise<SuspensionRecord[]>;
  abstract isSuspended(userId: string, now: Date): Promise<boolean>;

  /** False when the source event was already counted. */
  abstract recordActivity(row: {
    sourceEventId: string;
    userId: string;
    kind: TrustSignalKind;
    occurredAt: Date;
  }): Promise<boolean>;
  abstract countActivity(userId: string, kind: TrustSignalKind, since: Date): Promise<number>;
  abstract purgeActivity(before: Date): Promise<number>;

  abstract transparency(from: Date, to: Date): Promise<TransparencyCounts>;
}
