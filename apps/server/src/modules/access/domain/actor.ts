import type { Role } from '@pitchorium/contracts';

/** Authenticated member performing a request, with the facts the policies need. */
export interface Actor {
  userId: string;
  sessionId: string;
  /** Always contains `member`. */
  roles: readonly Role[];
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  /** Current terms and privacy policy accepted, age declared. */
  legalUpToDate: boolean;
  /** Sign-in time of the session, for the actions that require a recent authentication. */
  authenticatedAt: Date;
}

/** What an action applies to; `ownerId` drives ownership policies. */
export interface AccessResource {
  type: string;
  id: string;
  ownerId: string | null;
  /** Roles of the actor on the resource, given by the module that owns it. */
  roles?: readonly string[];
}
