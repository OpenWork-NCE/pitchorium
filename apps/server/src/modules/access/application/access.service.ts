import { Injectable } from '@nestjs/common';
import {
  type Action,
  type ActionPrerequisites,
  type Role,
  type TrustLevels,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { DomainError } from '../../../platform/kernel';
import { type AuthenticatedSession, IdentityFacade } from '../../identity';
import { ACTION_POLICIES } from '../domain/action-policies';
import {
  type AccessDecision,
  decide,
  policyOf,
  profileElementsRequiredBy,
  requiresKyc,
} from '../domain/access-policy';
import type { AccessResource, Actor } from '../domain/actor';
import { AccountStatusProvider, KycStatusProvider, RoleRepository } from './ports';
import { PrerequisiteRegistry } from './prerequisite.registry';

/** Own account: the default resource of /me routes. */
export function selfResource(actor: Actor): AccessResource {
  return { type: 'user', id: actor.userId, ownerId: actor.userId };
}

@Injectable()
export class AccessService {
  constructor(
    private readonly roles: RoleRepository,
    private readonly kyc: KycStatusProvider,
    private readonly accountStatus: AccountStatusProvider,
    private readonly prerequisites: PrerequisiteRegistry,
    private readonly identity: IdentityFacade,
    private readonly audit: AuditService,
  ) {}

  async rolesOf(userId: string): Promise<Role[]> {
    const assignments = await this.roles.assignments(userId);
    return ['member', ...assignments.map((assignment) => assignment.role)];
  }

  async actorFor(session: AuthenticatedSession): Promise<Actor> {
    return {
      userId: session.user.id,
      sessionId: session.sessionId,
      roles: await this.rolesOf(session.user.id),
      emailVerified: session.user.emailVerified,
      twoFactorEnabled: session.user.twoFactorEnabled,
      legalUpToDate: this.identity.legalStatus(session.user).upToDate,
    };
  }

  async trustLevels(userId: string, emailVerified: boolean): Promise<TrustLevels> {
    const [kycVerified, suspended] = await Promise.all([
      this.kyc.isVerified(userId),
      this.accountStatus.isSuspended(userId),
    ]);
    return { emailVerified, kycVerified, suspended };
  }

  /** Loads only the facts the action policy needs, then decides. */
  async decide(actor: Actor, action: Action, resource: AccessResource): Promise<AccessDecision> {
    const profileElements = profileElementsRequiredBy(action);
    const [suspended, kycVerified, missingProfileElements] = await Promise.all([
      this.accountStatus.isSuspended(actor.userId),
      requiresKyc(action) ? this.kyc.isVerified(actor.userId) : Promise.resolve(false),
      profileElements.length > 0
        ? this.prerequisites.missing(actor.userId, profileElements)
        : Promise.resolve([]),
    ]);
    return decide(action, { actor, resource, suspended, kycVerified, missingProfileElements });
  }

  async can(actor: Actor, action: Action, resource: AccessResource): Promise<boolean> {
    return (await this.decide(actor, action, resource)).allowed;
  }

  async assert(
    actor: Actor,
    action: Action,
    resource: AccessResource,
    requestId?: string,
  ): Promise<void> {
    const decision = await this.decide(actor, action, resource);
    if (decision.allowed) return;
    if (policyOf(action).sensitive) {
      await this.audit.record({
        actor: { type: 'user', id: actor.userId },
        action: 'access.action-denied',
        target: { type: resource.type, id: resource.id },
        metadata: { action, code: decision.code, missing: decision.missing },
        ...(requestId ? { requestId } : {}),
      });
    }
    throw new DomainError(decision.code, `Action ${action} denied`, { missing: decision.missing });
  }

  /**
   * What the actor still has to complete for an action (GET /v1/me/prerequisites/:action). A
   * role held on a resource is not an element to complete: the answer is given for an actor who
   * holds the role the policy requires (the owner of a project about to publish it, say).
   */
  async prerequisitesOf(actor: Actor, action: Action): Promise<ActionPrerequisites> {
    const roles = ACTION_POLICIES[action].resourceRoles ?? [];
    const decision = await this.decide(actor, action, { ...selfResource(actor), roles });
    return decision.allowed
      ? { action, allowed: true, code: null, missing: [] }
      : { action, allowed: false, code: decision.code, missing: decision.missing };
  }
}
