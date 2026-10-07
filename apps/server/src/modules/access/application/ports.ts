import type { AssignableRole, PrerequisiteElement } from '@pitchorium/contracts';

export interface StoredRoleAssignment {
  role: AssignableRole;
  grantedAt: Date;
  grantedBy: string | null;
}

export abstract class RoleRepository {
  abstract assignments(userId: string): Promise<StoredRoleAssignment[]>;
  /** False when the role was already assigned. */
  abstract grant(userId: string, assignment: StoredRoleAssignment): Promise<boolean>;
  /** False when the role was not assigned. */
  abstract revoke(userId: string, role: AssignableRole): Promise<boolean>;
  abstract countHolders(role: AssignableRole): Promise<number>;
}

/** Port: KYC status of a project holder. The payments module provides the real adapter. */
export abstract class KycStatusProvider {
  abstract isVerified(userId: string): Promise<boolean>;
}

/** Port: suspension decided by moderation. The trust module provides the real adapter. */
export abstract class AccountStatusProvider {
  abstract isSuspended(userId: string): Promise<boolean>;
}

/**
 * Implemented by the module that owns some prerequisite elements (profiles owns profile.*),
 * so that access depends on no module above it.
 */
export interface PrerequisiteProvider {
  readonly elements: readonly PrerequisiteElement[];
  missing(userId: string, elements: readonly PrerequisiteElement[]): Promise<PrerequisiteElement[]>;
}
