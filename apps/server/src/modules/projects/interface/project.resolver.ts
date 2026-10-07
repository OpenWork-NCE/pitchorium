import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { isShowable, ProjectReadsService } from '../application/project-reads.service';
import { ProjectRepository } from '../application/ports';

/**
 * Resource of the `:projectId` routes: a live project and the role the principal holds in its
 * team (`owner`, `editor`), which the access policies require (`resourceRoles`). A project that
 * is unknown, deleted, or not public and outside the principal's team answers 404.
 */
@Injectable()
export class ProjectResolver implements ResourceResolver {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly reads: ProjectReadsService,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['projectId']);
    if (!id.success) return null;
    const project = await this.projects.findProject(id.data);
    if (!project || project.deletedAt) return null;
    const role = await this.reads.teamRoleOf(id.data, principal.userId);
    if (!role && !isShowable(project)) return null;
    return { type: 'project', id: id.data, ownerId: project.ownerId, roles: role ? [role] : [] };
  }
}
