import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

abstract class ReportEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'report';
}

abstract class DecisionEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'moderation_decision';
}

abstract class SuspensionEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'suspension';
}

/** A report or a notice was received; the reporter is acknowledged (null without account). */
export class ReportCreated extends ReportEvent<{
  caseId: string;
  targetType: string;
  reason: string;
  reporterId: string | null;
}> {
  static readonly TYPE = 'trust.report.created.v1';
  readonly type = ReportCreated.TYPE;
  constructor(props: DomainEventProps<ReportCreated['payload']>) {
    super(props);
  }
}

/** The case of the report was decided: the reporter is told the outcome. */
export class ReportResolved extends ReportEvent<{
  caseId: string;
  reporterId: string | null;
  outcome: string;
}> {
  static readonly TYPE = 'trust.report.resolved.v1';
  readonly type = ReportResolved.TYPE;
  constructor(props: DomainEventProps<ReportResolved['payload']>) {
    super(props);
  }
}

/** A decision with its statement of reasons, sent to the member concerned (`subjectId`). */
export class DecisionTaken extends DecisionEvent<{
  caseId: string;
  subjectId: string | null;
  kind: string;
  targetType: string;
  targetId: string;
}> {
  static readonly TYPE = 'trust.decision.taken.v1';
  readonly type = DecisionTaken.TYPE;
  constructor(props: DomainEventProps<DecisionTaken['payload']>) {
    super(props);
  }
}

export class DecisionAppealed extends DecisionEvent<{ appealId: string; appellantId: string }> {
  static readonly TYPE = 'trust.decision.appealed.v1';
  readonly type = DecisionAppealed.TYPE;
  constructor(props: DomainEventProps<DecisionAppealed['payload']>) {
    super(props);
  }
}

/** `overturned` reverts the effects of the decision. */
export class AppealResolved extends DecisionEvent<{
  appealId: string;
  appellantId: string;
  outcome: string;
}> {
  static readonly TYPE = 'trust.decision.appeal-resolved.v1';
  readonly type = AppealResolved.TYPE;
  constructor(props: DomainEventProps<AppealResolved['payload']>) {
    super(props);
  }
}

/**
 * Internal: refunds of the contributions of a frozen project, decided by an administrator;
 * the worker refunds them one by one through the payments module.
 */
export class ProjectRefundsRequested extends DecisionEvent<{
  projectId: string;
  contributionIds: string[];
  reason: string;
  requestedBy: string;
}> {
  static readonly TYPE = 'trust.project.refunds-requested.v1';
  readonly type = ProjectRefundsRequested.TYPE;
  constructor(props: DomainEventProps<ProjectRefundsRequested['payload']>) {
    super(props);
  }
}

export class SuspensionStarted extends SuspensionEvent<{
  userId: string;
  decisionId: string;
  /** Null for a permanent suspension. */
  endsAt: string | null;
}> {
  static readonly TYPE = 'trust.suspension.started.v1';
  readonly type = SuspensionStarted.TYPE;
  constructor(props: DomainEventProps<SuspensionStarted['payload']>) {
    super(props);
  }
}

/** `expired` at its end, `lifted` early by a moderator, `overturned` on appeal. */
export class SuspensionEnded extends SuspensionEvent<{
  userId: string;
  decisionId: string;
  cause: 'expired' | 'lifted' | 'overturned';
}> {
  static readonly TYPE = 'trust.suspension.ended.v1';
  readonly type = SuspensionEnded.TYPE;
  constructor(props: DomainEventProps<SuspensionEnded['payload']>) {
    super(props);
  }
}
