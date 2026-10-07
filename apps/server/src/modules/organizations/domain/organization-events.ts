import type { InvitableRole, OrganizationRole } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** Every organization event has the organization as aggregate; payloads hold ids, no email. */
abstract class OrganizationEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'organization';
}

export class OrganizationCreated extends OrganizationEvent<{ slug: string; createdBy: string }> {
  static readonly TYPE = 'organizations.organization.created.v1';
  readonly type = OrganizationCreated.TYPE;
  constructor(props: DomainEventProps<OrganizationCreated['payload']>) {
    super(props);
  }
}

/** Lists the changed field names (`slug`, `logo` and `cover` included), never their values. */
export class OrganizationUpdated extends OrganizationEvent<{ fields: string[] }> {
  static readonly TYPE = 'organizations.organization.updated.v1';
  readonly type = OrganizationUpdated.TYPE;
  constructor(props: DomainEventProps<OrganizationUpdated['payload']>) {
    super(props);
  }
}

export class OrganizationDeleted extends OrganizationEvent<{ deletedBy: string }> {
  static readonly TYPE = 'organizations.organization.deleted.v1';
  readonly type = OrganizationDeleted.TYPE;
  constructor(props: DomainEventProps<OrganizationDeleted['payload']>) {
    super(props);
  }
}

export class MemberInvited extends OrganizationEvent<{
  invitationId: string;
  role: InvitableRole;
  invitedBy: string;
}> {
  static readonly TYPE = 'organizations.member.invited.v1';
  readonly type = MemberInvited.TYPE;
  constructor(props: DomainEventProps<MemberInvited['payload']>) {
    super(props);
  }
}

export class MemberJoined extends OrganizationEvent<{
  userId: string;
  role: OrganizationRole;
  invitationId: string;
}> {
  static readonly TYPE = 'organizations.member.joined.v1';
  readonly type = MemberJoined.TYPE;
  constructor(props: DomainEventProps<MemberJoined['payload']>) {
    super(props);
  }
}

export class MemberLeft extends OrganizationEvent<{
  userId: string;
  reason: 'left' | 'removed';
  by: string;
}> {
  static readonly TYPE = 'organizations.member.left.v1';
  readonly type = MemberLeft.TYPE;
  constructor(props: DomainEventProps<MemberLeft['payload']>) {
    super(props);
  }
}

export class MemberRoleChanged extends OrganizationEvent<{
  userId: string;
  previousRole: OrganizationRole;
  role: OrganizationRole;
  by: string;
}> {
  static readonly TYPE = 'organizations.member.role-changed.v1';
  readonly type = MemberRoleChanged.TYPE;
  constructor(props: DomainEventProps<MemberRoleChanged['payload']>) {
    super(props);
  }
}

export class OwnershipTransferred extends OrganizationEvent<{
  fromUserId: string;
  toUserId: string;
}> {
  static readonly TYPE = 'organizations.ownership.transferred.v1';
  readonly type = OwnershipTransferred.TYPE;
  constructor(props: DomainEventProps<OwnershipTransferred['payload']>) {
    super(props);
  }
}

export class VerificationRequested extends OrganizationEvent<{
  requestId: string;
  requestedBy: string;
}> {
  static readonly TYPE = 'organizations.verification.requested.v1';
  readonly type = VerificationRequested.TYPE;
  constructor(props: DomainEventProps<VerificationRequested['payload']>) {
    super(props);
  }
}

export class VerificationApproved extends OrganizationEvent<{
  requestId: string;
  decidedBy: string;
}> {
  static readonly TYPE = 'organizations.verification.approved.v1';
  readonly type = VerificationApproved.TYPE;
  constructor(props: DomainEventProps<VerificationApproved['payload']>) {
    super(props);
  }
}

export class VerificationRejected extends OrganizationEvent<{
  requestId: string;
  decidedBy: string;
}> {
  static readonly TYPE = 'organizations.verification.rejected.v1';
  readonly type = VerificationRejected.TYPE;
  constructor(props: DomainEventProps<VerificationRejected['payload']>) {
    super(props);
  }
}

/** The motivation is moderation text about the organization, shared with its owners. */
export class VerificationRevoked extends OrganizationEvent<{ revokedBy: string; reason: string }> {
  static readonly TYPE = 'organizations.verification.revoked.v1';
  readonly type = VerificationRevoked.TYPE;
  constructor(props: DomainEventProps<VerificationRevoked['payload']>) {
    super(props);
  }
}
