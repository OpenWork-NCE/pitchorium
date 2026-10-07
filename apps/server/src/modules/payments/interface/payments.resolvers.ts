import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { OrganizationsFacade } from '../../organizations';
import { ProjectsFacade } from '../../projects';
import { PaymentsRepository } from '../application/ports';

function idParam(request: Request, name: string): string | null {
  const parsed = uuidV7Schema.safeParse(request.params[name]);
  return parsed.success ? parsed.data : null;
}

/** A contribution of the principal: other contributions answer 404. */
@Injectable()
export class ContributionResolver implements ResourceResolver {
  constructor(private readonly payments: PaymentsRepository) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'contributionId');
    if (!id) return null;
    const contribution = await this.payments.findContribution(id);
    if (!contribution || contribution.contributorId !== principal.userId) return null;
    return { type: 'contribution', id, ownerId: contribution.contributorId };
  }
}

/** A live project and the role the principal holds in its team (`owner`, `editor`). */
@Injectable()
export class ProjectTeamResolver implements ResourceResolver {
  constructor(private readonly projects: ProjectsFacade) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'projectId');
    if (!id) return null;
    const project = await this.projects.fundable(id);
    if (!project) return null;
    const role = await this.projects.teamRoleOf(id, principal.userId);
    if (!role && !project.showable) return null;
    return { type: 'project', id, ownerId: project.ownerId, roles: role ? [role] : [] };
  }
}

/** A live organization and the role of the principal in it. */
@Injectable()
export class OrganizationRoleResolver implements ResourceResolver {
  constructor(private readonly organizations: OrganizationsFacade) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'organizationId');
    if (!id) return null;
    if (!(await this.organizations.summaries([id])).has(id)) return null;
    const role = await this.organizations.roleOf(id, principal.userId);
    return { type: 'organization', id, ownerId: null, roles: role ? [role] : [] };
  }
}

/** An off-platform contribution: `contributor` for its contributor, `holder` for the owners. */
@Injectable()
export class OfflineContributionResolver implements ResourceResolver {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly projects: ProjectsFacade,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = idParam(request, 'offlineContributionId');
    if (!id) return null;
    const record = await this.payments.findOffline(id);
    if (!record) return null;
    const roles: string[] = [];
    if (record.contributorId === principal.userId) roles.push('contributor');
    if ((await this.projects.teamRoleOf(record.projectId, principal.userId)) === 'owner') {
      roles.push('holder');
    }
    if (roles.length === 0) return null;
    return { type: 'offline_contribution', id, ownerId: record.contributorId, roles };
  }
}
