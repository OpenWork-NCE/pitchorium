import { Injectable, Optional } from '@nestjs/common';
import { PrivacyRepository } from './ports';
import {
  type AccountDirectory,
  type PersonalDataRegistration,
  PersonalDataRegistry,
} from './personal-data';

/**
 * Public facade of the privacy module: every module holding personal data registers its
 * exporter and its eraser here at startup (ADR 0074), identity its account directory.
 */
@Injectable()
export class PrivacyFacade {
  constructor(
    private readonly registry: PersonalDataRegistry,
    @Optional() private readonly privacy?: PrivacyRepository,
  ) {}

  /** Exports being built and erasures not finished (administration statistics). */
  async openRequests(): Promise<number> {
    return this.privacy ? this.privacy.openRequests() : 0;
  }

  registerPersonalData(registration: PersonalDataRegistration): void {
    this.registry.register(registration);
  }

  registerAccountDirectory(directory: AccountDirectory): void {
    this.registry.registerAccountDirectory(directory);
  }

  /** Modules registered, by erasure order (architecture test, administration). */
  registeredModules(): string[] {
    return this.registry.modules();
  }
}
