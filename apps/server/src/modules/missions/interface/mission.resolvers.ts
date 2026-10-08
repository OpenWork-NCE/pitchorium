import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { ProjectsFacade } from '../../projects';
import { MissionReadsService } from '../application/mission-reads.service';
import { MissionsRepository } from '../application/ports';
import { sidesOf } from '../domain/mission';

/**
 * Resource of the `:missionId` routes: a mission the principal may see, `author` for its
 * author or the team of its project. A mission they may not see answers 404.
 */
@Injectable()
export class MissionResolver implements ResourceResolver {
  constructor(
    private readonly missions: MissionsRepository,
    private readonly reads: MissionReadsService,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['missionId']);
    if (!id.success) return null;
    const mission = await this.missions.findMission(id.data);
    const reader = { kind: 'member' as const, viewerId: principal.userId };
    if (!mission || !(await this.reads.canSee(mission, reader))) return null;
    const author = await this.reads.canManage(mission, principal.userId);
    return {
      type: 'mission',
      id: mission.id,
      ownerId: mission.authorId,
      roles: author ? ['author'] : [],
    };
  }
}

/**
 * Resource of the `:engagementId` routes, for its two sides only: `expert` gives the time,
 * `beneficiary` receives it (the member, or the team of the project), `responder` is the author
 * of the mission who answers. Anyone else gets 404.
 */
@Injectable()
export class EngagementResolver implements ResourceResolver {
  constructor(
    private readonly missions: MissionsRepository,
    private readonly reads: MissionReadsService,
    private readonly projects: ProjectsFacade,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['engagementId']);
    if (!id.success) return null;
    const engagement = await this.missions.findEngagement(id.data);
    const mission = engagement ? await this.missions.findMission(engagement.missionId) : null;
    if (!engagement || !mission) return null;
    const userId = principal.userId;
    const team =
      engagement.projectId !== null &&
      (await this.projects.teamRoleOf(engagement.projectId, userId)) !== null;
    const roles = [
      ...(engagement.expertId === userId ? ['expert'] : []),
      ...(engagement.beneficiaryId === userId || team ? ['beneficiary'] : []),
      ...(sidesOf(mission, engagement).responderId === userId ||
      (await this.reads.canManage(mission, userId))
        ? ['responder']
        : []),
    ];
    if (roles.length === 0) return null;
    return { type: 'mission_engagement', id: engagement.id, ownerId: null, roles };
  }
}
