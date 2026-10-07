import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { RoleRepository } from './ports';
import { RoleService } from './role.service';

export type AdminBootstrapResult = 'granted' | 'already-admin';

/**
 * Grants the admin role to an existing account, from the command line only (never through the
 * api). Idempotent: running it again changes nothing.
 */
@Injectable()
export class AdminBootstrapService {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly roles: RoleRepository,
    private readonly roleService: RoleService,
  ) {}

  async ensureAdmin(email: string): Promise<AdminBootstrapResult> {
    const user = await this.identity.findUserByEmail(email);
    if (!user) {
      throw new DomainError(
        'IDENTITY_USER_NOT_FOUND',
        'No account uses this email: sign up first, then run the command again',
      );
    }
    const assignments = await this.roles.assignments(user.id);
    if (assignments.some((assignment) => assignment.role === 'admin')) return 'already-admin';
    await this.roleService.grant(user.id, 'admin', { actorId: null });
    return 'granted';
  }
}
