import { Injectable } from '@nestjs/common';
import type { Role, TrustLevels } from '@pitchorium/contracts';
import { AccessService } from './access.service';
import { RegisteredKycStatusProvider } from './kyc-status.registry';
import type { KycStatusSource, PrerequisiteProvider } from './ports';
import { PrerequisiteRegistry } from './prerequisite.registry';

/** Public facade of the access module, for the other modules. */
@Injectable()
export class AccessFacade {
  constructor(
    private readonly access: AccessService,
    private readonly registry: PrerequisiteRegistry,
    private readonly kyc: RegisteredKycStatusProvider,
  ) {}

  rolesOf(userId: string): Promise<Role[]> {
    return this.access.rolesOf(userId);
  }

  trustLevels(userId: string, emailVerified: boolean): Promise<TrustLevels> {
    return this.access.trustLevels(userId, emailVerified);
  }

  /** Called at startup by the module that owns the elements (profiles owns profile.*). */
  registerPrerequisiteProvider(provider: PrerequisiteProvider): void {
    this.registry.register(provider);
  }

  /** Called at startup by the payments module, which implements the KYC of holders. */
  registerKycStatusProvider(source: KycStatusSource): void {
    this.kyc.register(source);
  }
}
