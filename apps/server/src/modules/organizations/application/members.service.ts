import { Injectable } from '@nestjs/common';
import type { OrganizationRole } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { DomainError } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import {
  assertCanLeave,
  assertRemoval,
  assertRoleChange,
  transferOwnership,
} from '../domain/membership-rules';
import type { MemberRecord } from '../domain/organization';
import { MemberLeft, MemberRoleChanged, OwnershipTransferred } from '../domain/organization-events';
import { OrganizationEventsRecorder } from './organization-events.recorder';
import { OrganizationReadsService } from './organization-reads.service';
import { OrganizationRepository } from './ports';

/**
 * Internal roles of an organization. Role writes of one organization are serialised, so that
 * two concurrent changes can never leave it without an owner.
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly reads: OrganizationReadsService,
    private readonly profiles: ProfilesFacade,
    private readonly events: OrganizationEventsRecorder,
    private readonly transactions: TransactionManager,
  ) {}

  async changeRole(
    organizationId: string,
    actorId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<void> {
    await this.reads.require(organizationId);
    await this.inRoleLock(organizationId, async () => {
      const actor = await this.member(organizationId, actorId);
      const target = await this.member(organizationId, userId);
      if (target.role === role) return;
      const owners = await this.organizations.countOwners(organizationId);
      assertRoleChange(actor.role, target.role, role, owners);
      await this.organizations.setRole(organizationId, userId, role);
      await this.events.record(MemberRoleChanged, organizationId, {
        userId,
        previousRole: target.role,
        role,
        by: actorId,
      });
    });
  }

  async remove(organizationId: string, actorId: string, userId: string): Promise<void> {
    await this.reads.require(organizationId);
    await this.inRoleLock(organizationId, async () => {
      const actor = await this.member(organizationId, actorId);
      const target = await this.member(organizationId, userId);
      assertRemoval(actor.role, target.role, await this.organizations.countOwners(organizationId));
      await this.leaveWith(organizationId, userId, 'removed', actorId);
    });
  }

  async leave(organizationId: string, userId: string): Promise<void> {
    await this.reads.require(organizationId);
    await this.inRoleLock(organizationId, async () => {
      const member = await this.member(organizationId, userId);
      assertCanLeave(member.role, await this.organizations.countOwners(organizationId));
      await this.leaveWith(organizationId, userId, 'left', userId);
    });
  }

  /** The new owner must already be a member; the previous owner stays as an admin. */
  async transferOwnership(organizationId: string, actorId: string, userId: string): Promise<void> {
    await this.reads.require(organizationId);
    await this.inRoleLock(organizationId, async () => {
      const actor = await this.member(organizationId, actorId);
      const target = await this.organizations.findMember(organizationId, userId);
      const roles = transferOwnership(actor.role, target?.role ?? null, actorId === userId);
      await this.organizations.setRole(organizationId, userId, roles.newOwner);
      await this.organizations.setRole(organizationId, actorId, roles.previousOwner);
      await this.events.record(OwnershipTransferred, organizationId, {
        fromUserId: actorId,
        toUserId: userId,
      });
    });
  }

  private async leaveWith(
    organizationId: string,
    userId: string,
    reason: 'left' | 'removed',
    by: string,
  ): Promise<void> {
    await this.organizations.removeMember(organizationId, userId);
    await this.profiles.unlinkOrganization(userId, organizationId);
    await this.events.record(MemberLeft, organizationId, { userId, reason, by });
  }

  private async member(organizationId: string, userId: string): Promise<MemberRecord> {
    const member = await this.organizations.findMember(organizationId, userId);
    if (!member) {
      throw new DomainError('ORGANIZATIONS_MEMBER_NOT_FOUND', 'Not a member of the organization');
    }
    return member;
  }

  private inRoleLock(organizationId: string, work: () => Promise<void>): Promise<void> {
    return this.transactions.run(async () => {
      await this.organizations.lock(`organizations:members:${organizationId}`);
      await work();
    });
  }
}
