import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { OrganizationsFacade } from '../application/organizations.facade';

/**
 * Resource of the `:organizationId` routes: a live organization and the role the principal
 * holds in it, which the access policies require (`resourceRoles`). Unknown: 404.
 */
@Injectable()
export class OrganizationResolver implements ResourceResolver {
  constructor(private readonly organizations: OrganizationsFacade) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['organizationId']);
    if (!id.success) return null;
    const summary = (await this.organizations.summaries([id.data])).get(id.data);
    if (!summary) return null;
    const role = await this.organizations.roleOf(id.data, principal.userId);
    return { type: 'organization', id: id.data, ownerId: null, roles: role ? [role] : [] };
  }
}
