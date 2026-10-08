import { Injectable } from '@nestjs/common';
import type { Locale } from '@pitchorium/contracts';
import type { BucketVisibility } from '../../../platform/storage';

/** A stored file of the member, copied into the archive under `files/`. */
export interface ExportedFile {
  name: string;
  visibility: BucketVisibility;
  key: string;
}

export interface PersonalDataExport {
  /** Serializable data of the member in the module: written as `<module>.json`. */
  data: Record<string, unknown>;
  files?: ExportedFile[];
}

/** Contract 1 of a module holding personal data: what it knows of a member (articles 15, 20). */
export interface PersonalDataExporter {
  export(userId: string): Promise<PersonalDataExport>;
}

/** A rule that prevents the erasure for now, with the stable code answered to the member. */
export interface ErasureBlocker {
  code: 'PRIVACY_CAMPAIGN_IN_PROGRESS' | 'PRIVACY_SOLE_OWNER';
  resourceId: string;
}

export interface ErasureContext {
  userId: string;
  email: string;
  /** Random identifier replacing the member where data is kept (same in every module). */
  pseudonym: string;
  at: Date;
}

/**
 * Contract 2: erases the member in the module (article 17), or pseudonymizes what the law
 * keeps. Idempotent and resumable: run again after a crash, it finds nothing more to do.
 */
export interface PersonalDataEraser {
  blockers?(userId: string): Promise<ErasureBlocker[]>;
  erase(context: ErasureContext): Promise<void>;
}

/** Order of the erasers: lower first, so that owners of shared data run before the account. */
export const ERASURE_ORDER = {
  /** Activity of the member that nothing else reads at erasure. */
  activity: 10,
  /** Contents that reference files and projects. */
  contents: 20,
  /** Projects and organizations, which hold the blocking rules. */
  ownership: 30,
  /** Financial records, kept pseudonymized. */
  financial: 40,
  /** Files, once the resources no longer reference them. */
  files: 80,
  profile: 90,
  /** The requests of the member themself. */
  privacy: 95,
  /**
   * Projections rebuilt from the other modules (search index): last before the account, so
   * that a reindex running meanwhile reads data already erased.
   */
  projections: 97,
  /** The account, last. */
  account: 100,
} as const;

export interface PersonalDataRegistration {
  module: string;
  /** What the JSON of the module holds, written in it (`description`). */
  description: string;
  order: number;
  exporter: PersonalDataExporter;
  eraser: PersonalDataEraser;
}

export interface AccountContact {
  email: string;
  name: string | null;
  locale: Locale;
}

/** Registered by identity: the contact of a member, for the confirmation of the erasure. */
export interface AccountDirectory {
  contact(userId: string): Promise<AccountContact | null>;
}

/**
 * Every module holding personal data registers its exporter and its eraser at startup, in
 * both processes (ADR 0074); privacy depends on no module.
 */
@Injectable()
export class PersonalDataRegistry {
  private readonly registrations = new Map<string, PersonalDataRegistration>();
  private accountDirectory: AccountDirectory | undefined;

  register(registration: PersonalDataRegistration): void {
    if (this.registrations.has(registration.module)) {
      throw new Error(`Personal data of ${registration.module} already registered`);
    }
    this.registrations.set(registration.module, registration);
  }

  registerAccountDirectory(directory: AccountDirectory): void {
    if (this.accountDirectory) throw new Error('An account directory is already registered');
    this.accountDirectory = directory;
  }

  /** By erasure order, then module name. */
  all(): PersonalDataRegistration[] {
    return [...this.registrations.values()].sort(
      (a, b) => a.order - b.order || a.module.localeCompare(b.module),
    );
  }

  modules(): string[] {
    return this.all().map((registration) => registration.module);
  }

  directory(): AccountDirectory {
    if (!this.accountDirectory) throw new Error('No account directory registered');
    return this.accountDirectory;
  }
}
