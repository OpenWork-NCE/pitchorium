import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

abstract class MissionEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'mission';
}

abstract class EngagementEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'mission_engagement';
}

export class MissionPublished extends MissionEvent<{
  authorId: string;
  direction: string;
  projectId: string | null;
}> {
  static readonly TYPE = 'missions.mission.published.v1';
  readonly type = MissionPublished.TYPE;
  constructor(props: DomainEventProps<MissionPublished['payload']>) {
    super(props);
  }
}

/** Lists the changed field names, never their values. */
export class MissionUpdated extends MissionEvent<{ fields: string[] }> {
  static readonly TYPE = 'missions.mission.updated.v1';
  readonly type = MissionUpdated.TYPE;
  constructor(props: DomainEventProps<MissionUpdated['payload']>) {
    super(props);
  }
}

export class MissionClosed extends MissionEvent<{ by: string }> {
  static readonly TYPE = 'missions.mission.closed.v1';
  readonly type = MissionClosed.TYPE;
  constructor(props: DomainEventProps<MissionClosed['payload']>) {
    super(props);
  }
}

/** An application to a request, or a solicitation of an offer, waits for the author. */
export class EngagementRequested extends EngagementEvent<{
  missionId: string;
  requesterId: string;
  responderId: string;
}> {
  static readonly TYPE = 'missions.engagement.requested.v1';
  readonly type = EngagementRequested.TYPE;
  constructor(props: DomainEventProps<EngagementRequested['payload']>) {
    super(props);
  }
}

export class EngagementAccepted extends EngagementEvent<{
  missionId: string;
  requesterId: string;
  responderId: string;
}> {
  static readonly TYPE = 'missions.engagement.accepted.v1';
  readonly type = EngagementAccepted.TYPE;
  constructor(props: DomainEventProps<EngagementAccepted['payload']>) {
    super(props);
  }
}

export class EngagementDeclined extends EngagementEvent<{
  missionId: string;
  requesterId: string;
  responderId: string;
}> {
  static readonly TYPE = 'missions.engagement.declined.v1';
  readonly type = EngagementDeclined.TYPE;
  constructor(props: DomainEventProps<EngagementDeclined['payload']>) {
    super(props);
  }
}

/** The expert completed the mission; the time waits for the beneficiary in the time log. */
export class EngagementCompleted extends EngagementEvent<{
  missionId: string;
  expertId: string;
  beneficiaryId: string;
  projectId: string | null;
  timeEntryId: string;
}> {
  static readonly TYPE = 'missions.engagement.completed.v1';
  readonly type = EngagementCompleted.TYPE;
  constructor(props: DomainEventProps<EngagementCompleted['payload']>) {
    super(props);
  }
}

export class EngagementCanceled extends EngagementEvent<{ missionId: string; by: string }> {
  static readonly TYPE = 'missions.engagement.canceled.v1';
  readonly type = EngagementCanceled.TYPE;
  constructor(props: DomainEventProps<EngagementCanceled['payload']>) {
    super(props);
  }
}
