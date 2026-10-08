import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { ProjectsFacade } from '../../projects';

/**
 * A published project and the role the principal holds in its team (`owner`, `editor`): its
 * potential contributors are shown to the team only. Otherwise 404.
 */
@Injectable()
export class ProjectTeamResolver implements ResourceResolver {
  constructor(private readonly projects: ProjectsFacade) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['projectId']);
    if (!id.success) return null;
    const [project, role] = await Promise.all([
      this.projects.fundable(id.data),
      this.projects.teamRoleOf(id.data, principal.userId),
    ]);
    if (!project?.showable || !role) return null;
    return { type: 'project', id: project.id, ownerId: project.ownerId, roles: [role] };
  }
}
