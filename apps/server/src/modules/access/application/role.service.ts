import { Injectable } from '@nestjs/common';
import type { AssignableRole, UserRoles } from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import { IdentityFacade } from '../../identity';
import { RoleGranted, RoleRevoked } from '../domain/access-events';
import { RoleRepository } from './ports';

export interface RoleChangeContext {
  /** Null for the command line. */
  actorId: string | null;
  requestId?: string;
}

@Injectable()
export class RoleService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly identity: IdentityFacade,
    private readonly transactions: TransactionManager,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<UserRoles> {
    await this.requireUser(userId);
    const assignments = await this.roles.assignments(userId);
    return {
      userId,
      assignments: assignments.map((assignment) => ({
        role: assignment.role,
        grantedAt: assignment.grantedAt.toISOString(),
        grantedBy: assignment.grantedBy,
      })),
    };
  }

  /**
   * Idempotent. A new privilege signs the user out everywhere (session rotation): the role,
   * and its 2FA requirement, then apply to fresh sessions only.
   */
  async grant(
    userId: string,
    role: AssignableRole,
    context: RoleChangeContext,
  ): Promise<UserRoles> {
    await this.requireUser(userId);
    await this.transactions.run(async () => {
      const now = this.clock.now();
      const granted = await this.roles.grant(userId, {
        role,
        grantedAt: now,
        grantedBy: context.actorId,
      });
      if (!granted) return;
      await this.audit.record({
        actor: context.actorId ? { type: 'user', id: context.actorId } : { type: 'system' },
        action: 'access.role-granted',
        target: { type: 'user', id: userId },
        metadata: { role },
        ...(context.requestId ? { requestId: context.requestId } : {}),
      });
      await this.outbox.record(
        new RoleGranted({
          id: this.ids.next(),
          aggregateId: userId,
          occurredAt: now,
          payload: { role, grantedBy: context.actorId },
        }),
      );
      await this.identity.revokeAllSessions(userId, 'privilege_change');
    });
    return this.list(userId);
  }

  async revoke(
    userId: string,
    role: AssignableRole,
    context: RoleChangeContext & { actorId: string },
  ): Promise<UserRoles> {
    await this.requireUser(userId);
    await this.transactions.run(async () => {
      if (role === 'admin' && (await this.roles.countHolders('admin')) <= 1) {
        const assignments = await this.roles.assignments(userId);
        if (assignments.some((assignment) => assignment.role === 'admin')) {
          throw new DomainError('ACCESS_LAST_ADMIN', 'The last administrator cannot be removed');
        }
      }
      if (!(await this.roles.revoke(userId, role))) return;
      const now = this.clock.now();
      await this.audit.record({
        actor: { type: 'user', id: context.actorId },
        action: 'access.role-revoked',
        target: { type: 'user', id: userId },
        metadata: { role },
        ...(context.requestId ? { requestId: context.requestId } : {}),
      });
      await this.outbox.record(
        new RoleRevoked({
          id: this.ids.next(),
          aggregateId: userId,
          occurredAt: now,
          payload: { role, revokedBy: context.actorId },
        }),
      );
    });
    return this.list(userId);
  }

  private async requireUser(userId: string): Promise<void> {
    if (!(await this.identity.findUser(userId))) {
      throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    }
  }
}
