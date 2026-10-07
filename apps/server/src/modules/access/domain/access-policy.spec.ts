import { type Action, ACTIONS, type PrerequisiteElement, type Role } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { type AccessFacts, decide } from './access-policy';
import type { Actor } from './actor';

type Scenario =
  | 'anonymous'
  | 'newcomer'
  | 'member'
  | 'entrepreneur'
  | 'suspended'
  | 'adminWithout2fa'
  | 'admin'
  | 'moderator';

type Expected = 'allow' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SUSPENDED' | PrerequisiteElement[];

const SELF = 'user-1';

function actor(overrides: Partial<Actor> = {}, roles: Role[] = ['member']): Actor {
  return {
    userId: SELF,
    sessionId: 'session-1',
    roles,
    emailVerified: true,
    twoFactorEnabled: false,
    legalUpToDate: true,
    ...overrides,
  };
}

function facts(scenario: Scenario): AccessFacts {
  const base: AccessFacts = {
    actor: actor(),
    resource: { type: 'user', id: SELF, ownerId: SELF },
    suspended: false,
    kycVerified: false,
    missingProfileElements: ['profile.entrepreneur_facet', 'profile.contributor_facet'],
  };
  switch (scenario) {
    case 'anonymous':
      return { ...base, actor: null };
    case 'newcomer':
      return { ...base, actor: actor({ emailVerified: false, legalUpToDate: false }) };
    case 'member':
      return base;
    case 'entrepreneur':
      return { ...base, missingProfileElements: ['profile.contributor_facet'] };
    case 'suspended':
      return { ...base, suspended: true };
    case 'adminWithout2fa':
      return { ...base, actor: actor({}, ['member', 'admin']) };
    case 'admin':
      return { ...base, actor: actor({ twoFactorEnabled: true }, ['member', 'admin']) };
    case 'moderator':
      return { ...base, actor: actor({ twoFactorEnabled: true }, ['member', 'moderator']) };
  }
}

const SCENARIOS: Scenario[] = [
  'anonymous',
  'newcomer',
  'member',
  'entrepreneur',
  'suspended',
  'adminWithout2fa',
  'admin',
  'moderator',
];

const everyoneSignedIn: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: 'allow',
  member: 'allow',
  entrepreneur: 'allow',
  suspended: 'allow',
  adminWithout2fa: 'allow',
  admin: 'allow',
  moderator: 'allow',
};

const membersWithAcceptedTerms: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: ['legal_acceptance'],
  member: 'allow',
  entrepreneur: 'allow',
  suspended: 'SUSPENDED',
  adminWithout2fa: 'allow',
  admin: 'allow',
  moderator: 'allow',
};

const adminsWith2fa: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: 'FORBIDDEN',
  member: 'FORBIDDEN',
  entrepreneur: 'FORBIDDEN',
  suspended: 'SUSPENDED',
  adminWithout2fa: ['two_factor'],
  admin: 'allow',
  moderator: 'FORBIDDEN',
};

const membersWithVerifiedEmail: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: ['email_verified', 'legal_acceptance'],
  member: 'allow',
  entrepreneur: 'allow',
  suspended: 'SUSPENDED',
  adminWithout2fa: 'allow',
  admin: 'allow',
  moderator: 'allow',
};

/** Actions on an organization, here without any role on it (see the test below). */
const organizationRoleRequired: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: 'FORBIDDEN',
  member: 'FORBIDDEN',
  entrepreneur: 'FORBIDDEN',
  suspended: 'SUSPENDED',
  adminWithout2fa: 'FORBIDDEN',
  admin: 'FORBIDDEN',
  moderator: 'FORBIDDEN',
};

const moderatorsAndAdminsWith2fa: Record<Scenario, Expected> = {
  ...adminsWith2fa,
  moderator: 'allow',
};

/** The complete matrix: every registered action against every kind of actor. */
const MATRIX: Record<Action, Record<Scenario, Expected>> = {
  'account.read': everyoneSignedIn,
  'account.preferences.update': everyoneSignedIn,
  'account.legal.accept': everyoneSignedIn,
  'profile.read': membersWithAcceptedTerms,
  'profile.update': membersWithAcceptedTerms,
  'access.roles.read': adminsWith2fa,
  'access.roles.manage': adminsWith2fa,
  'project.publish': {
    anonymous: 'UNAUTHENTICATED',
    newcomer: ['email_verified', 'legal_acceptance', 'profile.entrepreneur_facet'],
    member: ['profile.entrepreneur_facet'],
    entrepreneur: 'allow',
    suspended: 'SUSPENDED',
    adminWithout2fa: ['profile.entrepreneur_facet'],
    admin: ['profile.entrepreneur_facet'],
    moderator: ['profile.entrepreneur_facet'],
  },
  'media.upload': membersWithAcceptedTerms,
  'media.read': membersWithAcceptedTerms,
  'media.delete': membersWithAcceptedTerms,
  'organization.read': membersWithAcceptedTerms,
  'organization.create': membersWithVerifiedEmail,
  'organization.update': organizationRoleRequired,
  'organization.delete': organizationRoleRequired,
  'organization.member.invite': organizationRoleRequired,
  'organization.member.manage': organizationRoleRequired,
  'organization.member.leave': organizationRoleRequired,
  'organization.ownership.transfer': organizationRoleRequired,
  'organization.invitation.respond': membersWithVerifiedEmail,
  'organization.verification.request': organizationRoleRequired,
  'organization.verification.review': moderatorsAndAdminsWith2fa,
  'network.read': membersWithAcceptedTerms,
  'network.follow': membersWithAcceptedTerms,
  'network.connection.request': membersWithVerifiedEmail,
  'network.connection.respond': membersWithAcceptedTerms,
  'network.connection.remove': membersWithAcceptedTerms,
  'network.block': membersWithAcceptedTerms,
  'network.settings.update': membersWithAcceptedTerms,
  'network.profile-views.read': membersWithAcceptedTerms,
};

function outcome(action: Action, scenario: Scenario): Expected {
  const decision = decide(action, facts(scenario));
  if (decision.allowed) return 'allow';
  if (decision.code === 'ACCESS_PREREQUISITES_MISSING') return [...decision.missing].sort();
  if (decision.code === 'ACCESS_ACCOUNT_SUSPENDED') return 'SUSPENDED';
  if (decision.code === 'UNAUTHENTICATED' || decision.code === 'FORBIDDEN') return decision.code;
  throw new Error(`Unexpected code ${decision.code}`);
}

describe('access policies', () => {
  it('has a matrix row for every registered action', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...ACTIONS].sort());
  });

  describe.each(ACTIONS.map((action) => [action] as const))('%s', (action) => {
    it.each(SCENARIOS)('%s', (scenario) => {
      expect(outcome(action, scenario)).toEqual(MATRIX[action][scenario]);
    });
  });

  it('refuses owner-only actions on someone else’s resource', () => {
    const other = { type: 'user', id: 'user-2', ownerId: 'user-2' };
    for (const action of ['profile.update', 'project.publish'] as const) {
      expect(decide(action, { ...facts('entrepreneur'), resource: other })).toEqual({
        allowed: false,
        code: 'FORBIDDEN',
        missing: [],
      });
    }
    expect(decide('profile.read', { ...facts('member'), resource: other })).toEqual({
      allowed: true,
    });
  });

  it('grants organization actions by the role held on the organization', () => {
    const organization = (roles: string[]) => ({
      type: 'organization',
      id: 'org-1',
      ownerId: null,
      roles,
    });
    const allowed = (action: Action, roles: string[], scenario: Scenario = 'member') =>
      decide(action, { ...facts(scenario), resource: organization(roles) });

    expect(allowed('organization.update', ['admin'])).toEqual({ allowed: true });
    expect(allowed('organization.update', ['member'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('organization.delete', ['admin'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('organization.delete', ['owner'])).toEqual({ allowed: true });
    expect(allowed('organization.ownership.transfer', ['owner'])).toEqual({ allowed: true });
    expect(allowed('organization.member.leave', ['member'])).toEqual({ allowed: true });
    expect(allowed('organization.member.invite', ['owner'], 'newcomer')).toEqual({
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['email_verified', 'legal_acceptance'],
    });
    expect(allowed('organization.verification.request', ['owner'], 'suspended')).toMatchObject({
      code: 'ACCESS_ACCOUNT_SUSPENDED',
    });
  });
});
