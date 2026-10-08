import { Injectable } from '@nestjs/common';
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
  constructor(private readonly registry: PersonalDataRegistry) {}

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
