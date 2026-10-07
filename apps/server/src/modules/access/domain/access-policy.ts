import type { Action, ErrorCode, PrerequisiteElement } from '@pitchorium/contracts';
import { ACTION_POLICIES, type ActionPolicy } from './action-policies';
import type { AccessResource, Actor } from './actor';

/** Facts gathered by the application layer; the decision itself is pure. */
export interface AccessFacts {
  actor: Actor | null;
  resource: AccessResource | null;
  suspended: boolean;
  kycVerified: boolean;
  /** Profile elements (profile.*) the actor has not completed. */
  missingProfileElements: readonly PrerequisiteElement[];
}

export type AccessDecision =
  { allowed: true } | { allowed: false; code: ErrorCode; missing: PrerequisiteElement[] };

function deny(code: ErrorCode, missing: PrerequisiteElement[] = []): AccessDecision {
  return { allowed: false, code, missing };
}

export function policyOf(action: Action): ActionPolicy {
  return ACTION_POLICIES[action];
}

/** Profile elements whose state the application layer must load for this action. */
export function profileElementsRequiredBy(action: Action): PrerequisiteElement[] {
  return (policyOf(action).requires ?? []).filter((element) => element.startsWith('profile.'));
}

export function requiresKyc(action: Action): boolean {
  return (policyOf(action).requires ?? []).includes('kyc_verified');
}

function isSatisfied(element: PrerequisiteElement, facts: AccessFacts, actor: Actor): boolean {
  switch (element) {
    case 'legal_acceptance':
      return actor.legalUpToDate;
    case 'email_verified':
      return actor.emailVerified;
    case 'kyc_verified':
      return facts.kycVerified;
    case 'two_factor':
      return actor.twoFactorEnabled;
    case 'profile.entrepreneur_facet':
    case 'profile.contributor_facet':
      return !facts.missingProfileElements.includes(element);
  }
}

/**
 * Order of checks: authentication, suspension, role, ownership, then every missing
 * prerequisite at once, so that the client can open the right form (cahier des charges 7.2).
 */
export function decide(action: Action, facts: AccessFacts): AccessDecision {
  const policy = policyOf(action);
  const { actor } = facts;
  if (!actor) return deny('UNAUTHENTICATED');
  if (facts.suspended && !policy.allowWhenSuspended) return deny('ACCESS_ACCOUNT_SUSPENDED');
  if (policy.roles && !policy.roles.some((role) => actor.roles.includes(role))) {
    return deny('FORBIDDEN');
  }
  if (policy.ownership === 'self' && facts.resource?.ownerId !== actor.userId) {
    return deny('FORBIDDEN');
  }

  const required = new Set<PrerequisiteElement>(policy.requires ?? []);
  if (policy.requiresLegalAcceptance !== false) required.add('legal_acceptance');
  if (policy.roles) required.add('two_factor');
  const missing = [...required].filter((element) => !isSatisfied(element, facts, actor));
  return missing.length > 0 ? deny('ACCESS_PREREQUISITES_MISSING', missing) : { allowed: true };
}
