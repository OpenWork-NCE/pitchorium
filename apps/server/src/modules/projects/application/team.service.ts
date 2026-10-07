import { Injectable } from '@nestjs/common';
import type { InviteTeamMemberRequest, UpdateTeamMemberRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import type { TeamMemberRecord } from '../domain/project';
import {
  TeamInvitationDeclined,
  TeamMemberAdded,
  TeamMemberInvited,
  TeamMemberRemoved,
} from '../domain/project-events';
import { assertCanGo, assertRoleChange } from '../domain/team';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

const memberNotFound = () =>
  new DomainError('PROJECTS_TEAM_MEMBER_NOT_FOUND', 'Project team member not found');

/**
 * Team of a project: members invited by handle with the role `owner` or `editor` and a
 * function shown on the page, acceptance with the public display consent (ADR 0040), leaving
 * and removal. The writes of one team are serialised, so that a project never loses its last
 * owner.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly profiles: ProfilesFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async invite(
    projectId: string,
    actorId: string,
    request: InviteTeamMemberRequest,
  ): Promise<void> {
    // A member on either side of a block with the inviter is unknown to them (ADR 0029).
    const userId = await this.profiles.userIdOf(request.handle, actorId);
    if (!userId) throw memberNotFound();
    await this.inTeamLock(projectId, async () => {
      const inserted = await this.projects.insertTeamMember({
        projectId,
        userId,
        role: request.role,
        function: request.function ?? null,
        status: 'invited',
        invitedBy: actorId,
        invitedAt: this.clock.now(),
        joinedAt: null,
        publicDisplayConsentAt: null,
      });
      if (!inserted) {
        throw new DomainError('PROJECTS_TEAM_MEMBER_EXISTS', 'Already in the team or invited');
      }
      await this.events.record(TeamMemberInvited, projectId, {
        userId,
        role: request.role,
        invitedBy: actorId,
      });
    });
  }

  /** The invited member joins and consents to the public display of their card. */
  async accept(projectId: string, userId: string): Promise<void> {
    await this.inTeamLock(projectId, async () => {
      const member = await this.invitation(projectId, userId);
      const now = this.clock.now();
      await this.projects.updateTeamMember(projectId, userId, {
        status: 'active',
        joinedAt: now,
        publicDisplayConsentAt: now,
      });
      await this.events.record(TeamMemberAdded, projectId, { userId, role: member.role });
    });
  }

  async decline(projectId: string, userId: string): Promise<void> {
    await this.inTeamLock(projectId, async () => {
      const invitation = await this.invitation(projectId, userId);
      await this.projects.deleteTeamMember(projectId, userId);
      await this.events.record(TeamInvitationDeclined, projectId, {
        userId,
        invitedBy: invitation.invitedBy,
      });
    });
  }

  async update(projectId: string, handle: string, patch: UpdateTeamMemberRequest): Promise<void> {
    const userId = await this.userIdOf(handle);
    await this.inTeamLock(projectId, async () => {
      const member = await this.member(projectId, userId);
      if (patch.role !== undefined && patch.role !== member.role) {
        assertRoleChange(member, patch.role, await this.projects.countActiveOwners(projectId));
      }
      await this.projects.updateTeamMember(projectId, userId, {
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.function !== undefined ? { function: patch.function } : {}),
      });
      if (patch.role !== undefined && patch.role !== 'owner')
        await this.handOver(projectId, userId);
    });
  }

  /** Removes a member or withdraws an invitation. */
  async remove(projectId: string, actorId: string, handle: string): Promise<void> {
    const userId = await this.userIdOf(handle);
    await this.inTeamLock(projectId, async () => {
      const member = await this.member(projectId, userId);
      assertCanGo(member, await this.projects.countActiveOwners(projectId));
      await this.projects.deleteTeamMember(projectId, userId);
      if (member.status === 'active') {
        await this.handOver(projectId, userId);
        await this.events.record(TeamMemberRemoved, projectId, {
          userId,
          reason: userId === actorId ? 'left' : 'removed',
          by: actorId,
        });
      }
    });
  }

  async leave(projectId: string, userId: string): Promise<void> {
    await this.inTeamLock(projectId, async () => {
      const member = await this.member(projectId, userId);
      assertCanGo(member, await this.projects.countActiveOwners(projectId));
      await this.projects.deleteTeamMember(projectId, userId);
      await this.handOver(projectId, userId);
      await this.events.record(TeamMemberRemoved, projectId, {
        userId,
        reason: 'left',
        by: userId,
      });
    });
  }

  /** When the holder shown on the page stops being an owner, the senior owner takes over. */
  private async handOver(projectId: string, formerOwnerId: string): Promise<void> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.ownerId !== formerOwnerId) return;
    const next = (await this.projects.teamMembers(projectId)).find(
      (member) => member.status === 'active' && member.role === 'owner',
    );
    if (next)
      await this.projects.updateProject(projectId, { ownerId: next.userId }, this.clock.now());
  }

  private async userIdOf(handle: string): Promise<string> {
    const userId = await this.profiles.userIdOf(handle);
    if (!userId) throw memberNotFound();
    return userId;
  }

  private async member(projectId: string, userId: string): Promise<TeamMemberRecord> {
    const member = await this.projects.findTeamMember(projectId, userId);
    if (!member) throw memberNotFound();
    return member;
  }

  private async invitation(projectId: string, userId: string): Promise<TeamMemberRecord> {
    const member = await this.projects.findTeamMember(projectId, userId);
    if (member?.status !== 'invited') {
      throw new DomainError('PROJECTS_INVITATION_NOT_FOUND', 'Project invitation not found');
    }
    return member;
  }

  private inTeamLock(projectId: string, work: () => Promise<void>): Promise<void> {
    return this.transactions.run(async () => {
      await this.projects.lock(`projects:team:${projectId}`);
      await work();
    });
  }
}
