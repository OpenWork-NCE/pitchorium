import type { ProjectInterestKind, ProjectTeamRole } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** Every project event has the project as aggregate; payloads hold ids and codes, no name. */
abstract class ProjectEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'project';
}

export class ProjectCreated extends ProjectEvent<{
  ownerId: string;
  organizationId: string | null;
}> {
  static readonly TYPE = 'projects.project.created.v1';
  readonly type = ProjectCreated.TYPE;
  constructor(props: DomainEventProps<ProjectCreated['payload']>) {
    super(props);
  }
}

/** Lists the changed field names, never their values. */
export class ProjectUpdated extends ProjectEvent<{ fields: string[] }> {
  static readonly TYPE = 'projects.project.updated.v1';
  readonly type = ProjectUpdated.TYPE;
  constructor(props: DomainEventProps<ProjectUpdated['payload']>) {
    super(props);
  }
}

export class ProjectPublished extends ProjectEvent<{
  ownerId: string;
  endsAt: string;
  goalMinor: string;
  currency: string;
}> {
  static readonly TYPE = 'projects.project.published.v1';
  readonly type = ProjectPublished.TYPE;
  constructor(props: DomainEventProps<ProjectPublished['payload']>) {
    super(props);
  }
}

/** The collected amount reached the goal; the project stays open until its end date. */
export class ProjectFunded extends ProjectEvent<{
  collectedMinor: string;
  goalMinor: string;
  currency: string;
}> {
  static readonly TYPE = 'projects.project.funded.v1';
  readonly type = ProjectFunded.TYPE;
  constructor(props: DomainEventProps<ProjectFunded['payload']>) {
    super(props);
  }
}

/** The end date is within PROJECTS_ENDING_SOON_HOURS (scheduled task). */
export class ProjectEndingSoon extends ProjectEvent<{ endsAt: string }> {
  static readonly TYPE = 'projects.project.ending-soon.v1';
  readonly type = ProjectEndingSoon.TYPE;
  constructor(props: DomainEventProps<ProjectEndingSoon['payload']>) {
    super(props);
  }
}

/** The end date passed: flexible funding, the reached tiers stay acquired (ADR 0038). */
export class ProjectClosed extends ProjectEvent<{
  collectedMinor: string;
  goalMinor: string;
  currency: string;
  goalReached: boolean;
}> {
  static readonly TYPE = 'projects.project.closed.v1';
  readonly type = ProjectClosed.TYPE;
  constructor(props: DomainEventProps<ProjectClosed['payload']>) {
    super(props);
  }
}

export class ProjectDeleted extends ProjectEvent<{ deletedBy: string }> {
  static readonly TYPE = 'projects.project.deleted.v1';
  readonly type = ProjectDeleted.TYPE;
  constructor(props: DomainEventProps<ProjectDeleted['payload']>) {
    super(props);
  }
}

export class TierUnlocked extends ProjectEvent<{
  tierId: string;
  position: number;
  thresholdMinor: string;
  currency: string;
}> {
  static readonly TYPE = 'projects.tier.unlocked.v1';
  readonly type = TierUnlocked.TYPE;
  constructor(props: DomainEventProps<TierUnlocked['payload']>) {
    super(props);
  }
}

export class UpdatePublished extends ProjectEvent<{ updateId: string; authorId: string }> {
  static readonly TYPE = 'projects.update.published.v1';
  readonly type = UpdatePublished.TYPE;
  constructor(props: DomainEventProps<UpdatePublished['payload']>) {
    super(props);
  }
}

export class RewardCreated extends ProjectEvent<{ rewardId: string }> {
  static readonly TYPE = 'projects.reward.created.v1';
  readonly type = RewardCreated.TYPE;
  constructor(props: DomainEventProps<RewardCreated['payload']>) {
    super(props);
  }
}

export class RewardUpdated extends ProjectEvent<{ rewardId: string; fields: string[] }> {
  static readonly TYPE = 'projects.reward.updated.v1';
  readonly type = RewardUpdated.TYPE;
  constructor(props: DomainEventProps<RewardUpdated['payload']>) {
    super(props);
  }
}

/** The last available unit of a limited reward was reserved. */
export class RewardSoldOut extends ProjectEvent<{ rewardId: string }> {
  static readonly TYPE = 'projects.reward.sold-out.v1';
  readonly type = RewardSoldOut.TYPE;
  constructor(props: DomainEventProps<RewardSoldOut['payload']>) {
    super(props);
  }
}

/** A member was invited into the team (A4: notified by the notifications module). */
export class TeamMemberInvited extends ProjectEvent<{
  userId: string;
  role: ProjectTeamRole;
  invitedBy: string;
}> {
  static readonly TYPE = 'projects.team.member-invited.v1';
  readonly type = TeamMemberInvited.TYPE;
  constructor(props: DomainEventProps<TeamMemberInvited['payload']>) {
    super(props);
  }
}

/** The invited member declined. */
export class TeamInvitationDeclined extends ProjectEvent<{
  userId: string;
  invitedBy: string | null;
}> {
  static readonly TYPE = 'projects.team.invitation-declined.v1';
  readonly type = TeamInvitationDeclined.TYPE;
  constructor(props: DomainEventProps<TeamInvitationDeclined['payload']>) {
    super(props);
  }
}

/** An invited member accepted, with their public display consent. */
export class TeamMemberAdded extends ProjectEvent<{ userId: string; role: ProjectTeamRole }> {
  static readonly TYPE = 'projects.team.member-added.v1';
  readonly type = TeamMemberAdded.TYPE;
  constructor(props: DomainEventProps<TeamMemberAdded['payload']>) {
    super(props);
  }
}

export class TeamMemberRemoved extends ProjectEvent<{
  userId: string;
  reason: 'left' | 'removed';
  by: string;
}> {
  static readonly TYPE = 'projects.team.member-removed.v1';
  readonly type = TeamMemberRemoved.TYPE;
  constructor(props: DomainEventProps<TeamMemberRemoved['payload']>) {
    super(props);
  }
}

export class InterestExpressed extends ProjectEvent<{
  interestId: string;
  userId: string;
  kind: ProjectInterestKind;
}> {
  static readonly TYPE = 'projects.interest.expressed.v1';
  readonly type = InterestExpressed.TYPE;
  constructor(props: DomainEventProps<InterestExpressed['payload']>) {
    super(props);
  }
}
