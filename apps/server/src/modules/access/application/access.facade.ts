import { Injectable } from '@nestjs/common';
import type { Action, AssignableRole, Role, TrustLevels } from '@pitchorium/contracts';
import type { Actor } from '../domain/actor';
import { AccessService, selfResource } from './access.service';
import { RegisteredAccountStatusProvider } from './account-status.registry';
import { RegisteredKycStatusProvider } from './kyc-status.registry';
import {
  type AccountStatusSource,
  type KycStatusSource,
  type PrerequisiteProvider,
  RoleRepository,
} from './ports';
import { PrerequisiteRegistry } from './prerequisite.registry';

/** Public facade of the access module, for the other modules. */
@Injectable()
export class AccessFacade {
  constructor(
    private readonly access: AccessService,
    private readonly registry: PrerequisiteRegistry,
    private readonly kyc: RegisteredKycStatusProvider,
    private readonly accountStatus: RegisteredAccountStatusProvider,
    private readonly roles: RoleRepository,
  ) {}

  rolesOf(userId: string): Promise<Role[]> {
    return this.access.rolesOf(userId);
  }

  /** Members holding any of the platform roles. */
  holdersOf(roles: readonly AssignableRole[]): Promise<string[]> {
    return this.roles.holders(roles);
  }

  trustLevels(userId: string, emailVerified: boolean): Promise<TrustLevels> {
    return this.access.trustLevels(userId, emailVerified);
  }

  /**
   * Asserts a second action within a route, for a refusal that depends on the request (the kind
   * of a moderation decision): the same policy, audit and error codes as a route.
   */
  assertAllowed(actor: Actor, action: Action, requestId?: string): Promise<void> {
    return this.access.assert(actor, action, selfResource(actor), requestId);
  }

  /** Called at startup by the module that owns the elements (profiles owns profile.*). */
  registerPrerequisiteProvider(provider: PrerequisiteProvider): void {
    this.registry.register(provider);
  }

  /** Called at startup by the payments module, which implements the KYC of holders. */
  registerKycStatusProvider(source: KycStatusSource): void {
    this.kyc.register(source);
  }

  /** Called at startup by the trust module, which implements suspensions. */
  registerAccountStatusSource(source: AccountStatusSource): void {
    this.accountStatus.register(source);
  }
}
