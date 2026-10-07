import type { Action, AssignableRole, PrerequisiteElement } from '@pitchorium/contracts';

export interface ActionPolicy {
  /** Roles allowed (any of). Absent: every member. Privileged roles also require 2FA. */
  roles?: readonly AssignableRole[];
  /** `self`: the resource must belong to the actor. */
  ownership?: 'self';
  /** Trust levels and profile elements to complete first. */
  requires?: readonly PrerequisiteElement[];
  /** False for the actions needed to read and accept the terms. Default true. */
  requiresLegalAcceptance?: boolean;
  allowWhenSuspended?: boolean;
  /** Refusals are written to the audit log. */
  sensitive?: boolean;
}

/**
 * Central registry of action policies. Deny by default: an action missing here does not
 * compile, and a protected route that declares no action is refused. Modules add their
 * actions here (names in @pitchorium/contracts).
 */
export const ACTION_POLICIES: Readonly<Record<Action, ActionPolicy>> = {
  'account.read': { requiresLegalAcceptance: false, allowWhenSuspended: true },
  'account.preferences.update': { requiresLegalAcceptance: false, allowWhenSuspended: true },
  'account.legal.accept': { requiresLegalAcceptance: false, allowWhenSuspended: true },
  'profile.read': {},
  'profile.update': { ownership: 'self' },
  'access.roles.read': { roles: ['admin'], sensitive: true },
  'access.roles.manage': { roles: ['admin'], sensitive: true },
  // Cahier des charges 7.2 step 4 and 7.3: verified email and a minimal entrepreneur facet.
  // The route arrives with the projects module; the policy already drives the prerequisites.
  'project.publish': {
    ownership: 'self',
    requires: ['email_verified', 'profile.entrepreneur_facet'],
    sensitive: true,
  },
};
