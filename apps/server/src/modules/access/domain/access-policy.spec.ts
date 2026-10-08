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
const NOW = new Date('2026-10-08T12:00:00Z');

function actor(overrides: Partial<Actor> = {}, roles: Role[] = ['member']): Actor {
  return {
    userId: SELF,
    sessionId: 'session-1',
    roles,
    emailVerified: true,
    twoFactorEnabled: false,
    legalUpToDate: true,
    authenticatedAt: NOW,
    ...overrides,
  };
}

function facts(scenario: Scenario): AccessFacts {
  const base: AccessFacts = {
    actor: actor(),
    resource: { type: 'user', id: SELF, ownerId: SELF },
    suspended: false,
    kycVerified: false,
    missingProvidedElements: [
      'profile.entrepreneur_facet',
      'profile.contributor_facet',
      'payout_account',
    ],
    recentAuthenticationSince: new Date(NOW.getTime() - 15 * 60_000),
  };
  switch (scenario) {
    case 'anonymous':
      return { ...base, actor: null };
    case 'newcomer':
      return { ...base, actor: actor({ emailVerified: false, legalUpToDate: false }) };
    case 'member':
      return base;
    case 'entrepreneur':
      return { ...base, missingProvidedElements: ['profile.contributor_facet', 'payout_account'] };
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

/** Actions on a project, here without any role in its team (see the test below). */
const projectRoleRequired = organizationRoleRequired;

const entrepreneursOnly: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: ['legal_acceptance', 'profile.entrepreneur_facet'],
  member: ['profile.entrepreneur_facet'],
  entrepreneur: 'allow',
  suspended: 'SUSPENDED',
  adminWithout2fa: ['profile.entrepreneur_facet'],
  admin: ['profile.entrepreneur_facet'],
  moderator: ['profile.entrepreneur_facet'],
};

/** Payout and KYC of a holder: an entrepreneur with a verified email. */
const entrepreneursWithVerifiedEmail: Record<Scenario, Expected> = {
  ...entrepreneursOnly,
  newcomer: ['email_verified', 'legal_acceptance', 'profile.entrepreneur_facet'],
};

/** Collected contributions open once the holder is verified and paid out (section 9.5). */
const holdersReadyToCollect: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: [
    'email_verified',
    'kyc_verified',
    'legal_acceptance',
    'payout_account',
    'profile.entrepreneur_facet',
  ],
  member: ['kyc_verified', 'payout_account', 'profile.entrepreneur_facet'],
  entrepreneur: ['kyc_verified', 'payout_account'],
  suspended: 'SUSPENDED',
  adminWithout2fa: ['kyc_verified', 'payout_account', 'profile.entrepreneur_facet'],
  admin: ['kyc_verified', 'payout_account', 'profile.entrepreneur_facet'],
  moderator: ['kyc_verified', 'payout_account', 'profile.entrepreneur_facet'],
};

/** Volunteer offers of missions: a contributor with a verified email (ADR 0071). */
const contributorsWithVerifiedEmail: Record<Scenario, Expected> = {
  anonymous: 'UNAUTHENTICATED',
  newcomer: ['email_verified', 'legal_acceptance', 'profile.contributor_facet'],
  member: ['profile.contributor_facet'],
  entrepreneur: ['profile.contributor_facet'],
  suspended: 'SUSPENDED',
  adminWithout2fa: ['profile.contributor_facet'],
  admin: ['profile.contributor_facet'],
  moderator: ['profile.contributor_facet'],
};

/** Actions on an event or a mission, here without any role on it (see the tests below). */
const resourceRoleRequired = organizationRoleRequired;

/** Own standing and appeals: still open to a suspended member. */
const membersEvenSuspended: Record<Scenario, Expected> = {
  ...membersWithAcceptedTerms,
  suspended: 'allow',
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
  'project.create': entrepreneursOnly,
  'project.read': membersWithAcceptedTerms,
  'project.update': projectRoleRequired,
  'project.delete': projectRoleRequired,
  'project.publish': projectRoleRequired,
  'project.team.manage': projectRoleRequired,
  'project.team.leave': projectRoleRequired,
  'project.invitation.respond': membersWithAcceptedTerms,
  'project.updates.publish': projectRoleRequired,
  'project.interest.express': membersWithVerifiedEmail,
  'project.interest.read': projectRoleRequired,
  'project.impact.assess': projectRoleRequired,
  'project.feature': moderatorsAndAdminsWith2fa,
  'impact.methodology.manage': adminsWith2fa,
  'impact.assessment.submit': entrepreneursOnly,
  'impact.assessment.read': membersWithAcceptedTerms,
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
  'content.feed.read': membersWithAcceptedTerms,
  'content.post.read': membersWithAcceptedTerms,
  'content.post.create': membersWithVerifiedEmail,
  'content.post.update': membersWithAcceptedTerms,
  'content.post.delete': membersWithAcceptedTerms,
  'content.post.repost': membersWithVerifiedEmail,
  'content.post.save': membersWithAcceptedTerms,
  'content.post.hide': membersWithAcceptedTerms,
  'content.post.feature': moderatorsAndAdminsWith2fa,
  'content.post.stats.read': membersWithAcceptedTerms,
  'content.reaction.set': membersWithAcceptedTerms,
  'content.comment.create': membersWithVerifiedEmail,
  'content.comment.update': membersWithAcceptedTerms,
  'content.comment.delete': organizationRoleRequired,
  'payment.quote': membersWithAcceptedTerms,
  'payment.contribute': membersWithVerifiedEmail,
  'payment.contribute.organization': organizationRoleRequired,
  'payment.contribution.read': membersWithAcceptedTerms,
  'payment.contribution.cancel': membersWithAcceptedTerms,
  'payment.project.contributions.read': projectRoleRequired,
  'payment.project.contributions.export': projectRoleRequired,
  'payment.collection.open': holdersReadyToCollect,
  'payment.offline.declare': membersWithVerifiedEmail,
  'payment.offline.declare.team': projectRoleRequired,
  'payment.offline.respond': organizationRoleRequired,
  'payment.offline.validate': adminsWith2fa,
  'payment.payout.configure': entrepreneursWithVerifiedEmail,
  'payment.kyc.submit': entrepreneursWithVerifiedEmail,
  'payment.kyc.review': adminsWith2fa,
  'payment.refund': adminsWith2fa,
  'payment.reconciliation.manage': adminsWith2fa,
  'engagement.dashboard.read': membersWithAcceptedTerms,
  'engagement.organization.dashboard.read': organizationRoleRequired,
  'engagement.time.declare': membersWithVerifiedEmail,
  'engagement.time.read': membersWithAcceptedTerms,
  'engagement.time.respond': organizationRoleRequired,
  'messaging.read': membersWithAcceptedTerms,
  'messaging.conversation.start': membersWithAcceptedTerms,
  'messaging.conversation.participate': organizationRoleRequired,
  'messaging.message.update': organizationRoleRequired,
  'messaging.request.respond': organizationRoleRequired,
  'messaging.settings.update': membersWithAcceptedTerms,
  'messaging.introduction.propose': membersWithVerifiedEmail,
  'messaging.introduction.respond': organizationRoleRequired,
  'notifications.read': membersEvenSuspended,
  'notifications.manage': membersEvenSuspended,
  'notifications.preferences.update': membersWithAcceptedTerms,
  'discovery.search': membersWithAcceptedTerms,
  'discovery.page.read': membersWithAcceptedTerms,
  'discovery.suggestions.read': membersWithAcceptedTerms,
  'discovery.suggestions.dismiss': membersWithAcceptedTerms,
  'discovery.project-suggestions.read': projectRoleRequired,
  'event.read': membersWithAcceptedTerms,
  'event.create': membersWithVerifiedEmail,
  'event.update': resourceRoleRequired,
  'event.publish': resourceRoleRequired,
  'event.cancel': resourceRoleRequired,
  'event.delete': resourceRoleRequired,
  'event.register': membersWithVerifiedEmail,
  'event.attendees.read': resourceRoleRequired,
  'event.calendar.manage': membersWithAcceptedTerms,
  'mission.read': membersWithAcceptedTerms,
  'mission.offer.create': contributorsWithVerifiedEmail,
  'mission.request.create': membersWithVerifiedEmail,
  'mission.update': resourceRoleRequired,
  'mission.close': resourceRoleRequired,
  'mission.engage': membersWithVerifiedEmail,
  'mission.engagement.read': resourceRoleRequired,
  'mission.engagement.respond': resourceRoleRequired,
  'mission.engagement.complete': resourceRoleRequired,
  'mission.engagement.cancel': resourceRoleRequired,
  'trust.report.create': membersWithAcceptedTerms,
  'trust.report.read': membersWithAcceptedTerms,
  'trust.standing.read': membersEvenSuspended,
  'trust.decision.appeal': { ...resourceRoleRequired, suspended: 'FORBIDDEN' },
  'trust.moderation.read': moderatorsAndAdminsWith2fa,
  'trust.moderation.assign': moderatorsAndAdminsWith2fa,
  'trust.moderation.decide': moderatorsAndAdminsWith2fa,
  'trust.appeal.resolve': moderatorsAndAdminsWith2fa,
  'trust.suspension.lift': moderatorsAndAdminsWith2fa,
  'trust.project.refund': adminsWith2fa,
  'trust.transparency.read': adminsWith2fa,
  'privacy.read': everyoneSignedIn,
  'privacy.export.request': everyoneSignedIn,
  'privacy.erasure.request': everyoneSignedIn,
  'privacy.erasure.cancel': everyoneSignedIn,
  'privacy.requests.read': adminsWith2fa,
  'localization.translate': membersWithAcceptedTerms,
  'localization.manage': adminsWith2fa,
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
    for (const action of ['profile.update', 'impact.assessment.submit'] as const) {
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

  it('lets the author of a comment or of its publication delete the comment', () => {
    const comment = (roles: string[]) => ({ type: 'comment', id: 'c-1', ownerId: 'user-2', roles });
    const decision = (roles: string[]) =>
      decide('content.comment.delete', { ...facts('member'), resource: comment(roles) });
    expect(decision(['author'])).toEqual({ allowed: true });
    expect(decision(['post_author'])).toEqual({ allowed: true });
    expect(decision([])).toMatchObject({ code: 'FORBIDDEN' });
    for (const action of ['content.post.update', 'content.comment.update'] as const) {
      const other = { type: 'post', id: 'p-1', ownerId: 'user-2' };
      expect(decide(action, { ...facts('member'), resource: other })).toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });

  it('grants project actions by the role held in the team, publication with prerequisites', () => {
    const project = (roles: string[]) => ({ type: 'project', id: 'p-1', ownerId: null, roles });
    const allowed = (action: Action, roles: string[], scenario: Scenario = 'entrepreneur') =>
      decide(action, { ...facts(scenario), resource: project(roles) });

    expect(allowed('project.update', ['editor'])).toEqual({ allowed: true });
    expect(allowed('project.publish', ['editor'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('project.publish', ['owner'])).toEqual({ allowed: true });
    expect(allowed('project.publish', ['owner'], 'member')).toEqual({
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['profile.entrepreneur_facet'],
    });
    expect(allowed('project.delete', ['editor'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('project.team.manage', ['owner'], 'newcomer')).toMatchObject({
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['email_verified', 'legal_acceptance'],
    });
    expect(allowed('project.interest.read', ['editor'])).toEqual({ allowed: true });
    expect(allowed('project.impact.assess', [])).toMatchObject({ code: 'FORBIDDEN' });
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

  it('grants payment and engagement actions by the role held on the resource', () => {
    const resource = (type: string, roles: string[]) => ({ type, id: 'r-1', ownerId: null, roles });
    const allowed = (
      action: Action,
      type: string,
      roles: string[],
      scenario: Scenario = 'member',
    ) => decide(action, { ...facts(scenario), resource: resource(type, roles) });

    expect(allowed('payment.contribute.organization', 'organization', ['admin'])).toEqual({
      allowed: true,
    });
    expect(allowed('payment.contribute.organization', 'organization', ['member'])).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(allowed('payment.project.contributions.export', 'project', ['editor'])).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(allowed('payment.project.contributions.read', 'project', ['owner'])).toEqual({
      allowed: true,
    });
    expect(allowed('payment.offline.declare.team', 'project', ['owner'], 'newcomer')).toEqual({
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['email_verified', 'legal_acceptance'],
    });
    expect(allowed('payment.offline.respond', 'offline_contribution', ['holder'])).toEqual({
      allowed: true,
    });
    expect(allowed('engagement.time.respond', 'time_entry', ['beneficiary'])).toEqual({
      allowed: true,
    });
    expect(allowed('engagement.organization.dashboard.read', 'organization', ['member'])).toEqual({
      allowed: true,
    });
  });

  it('grants messaging actions by the role held on the conversation, message or introduction', () => {
    const allowed = (
      action: Action,
      type: string,
      roles: string[],
      scenario: Scenario = 'member',
    ) =>
      decide(action, {
        ...facts(scenario),
        resource: { type, id: 'r-1', ownerId: null, roles },
      });
    expect(allowed('messaging.conversation.participate', 'conversation', ['participant'])).toEqual({
      allowed: true,
    });
    expect(allowed('messaging.message.update', 'message', ['participant'])).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(allowed('messaging.message.update', 'message', ['sender'])).toEqual({ allowed: true });
    expect(allowed('messaging.request.respond', 'conversation', ['request_recipient'])).toEqual({
      allowed: true,
    });
    expect(allowed('messaging.introduction.respond', 'introduction', ['introduced'])).toEqual({
      allowed: true,
    });
    expect(
      allowed('messaging.conversation.participate', 'conversation', ['participant'], 'suspended'),
    ).toMatchObject({ code: 'ACCESS_ACCOUNT_SUSPENDED' });
  });

  it('grants event actions to the organizer and the attendees, publication with prerequisites', () => {
    const event = (roles: string[]) => ({ type: 'event', id: 'e-1', ownerId: null, roles });
    const allowed = (action: Action, roles: string[], scenario: Scenario = 'member') =>
      decide(action, { ...facts(scenario), resource: event(roles) });
    expect(allowed('event.update', ['organizer'])).toEqual({ allowed: true });
    expect(allowed('event.update', ['attendee'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('event.publish', ['organizer'], 'newcomer')).toMatchObject({
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['email_verified', 'legal_acceptance'],
    });
    expect(allowed('event.attendees.read', ['attendee'])).toEqual({ allowed: true });
    expect(allowed('event.cancel', [])).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('grants mission actions by the side held on the mission or the engagement', () => {
    const resource = (roles: string[]) => ({ type: 'mission', id: 'm-1', ownerId: null, roles });
    const allowed = (action: Action, roles: string[]) =>
      decide(action, { ...facts('member'), resource: resource(roles) });
    expect(allowed('mission.update', ['author'])).toEqual({ allowed: true });
    expect(allowed('mission.engagement.respond', ['responder'])).toEqual({ allowed: true });
    expect(allowed('mission.engagement.respond', ['expert'])).toMatchObject({ code: 'FORBIDDEN' });
    expect(allowed('mission.engagement.complete', ['expert'])).toEqual({ allowed: true });
    expect(allowed('mission.engagement.complete', ['beneficiary'])).toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(allowed('mission.engagement.cancel', ['beneficiary'])).toEqual({ allowed: true });
    expect(allowed('mission.engagement.read', ['responder'])).toEqual({ allowed: true });
  });

  it('shows the potential contributors of a project to its team only', () => {
    const project = (roles: string[]) => ({ type: 'project', id: 'p-1', ownerId: null, roles });
    expect(
      decide('discovery.project-suggestions.read', {
        ...facts('member'),
        resource: project(['editor']),
      }),
    ).toEqual({ allowed: true });
    expect(
      decide('discovery.project-suggestions.read', { ...facts('member'), resource: project([]) }),
    ).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets the member concerned appeal a decision, even suspended', () => {
    const decision = (roles: string[]) => ({ type: 'decision', id: 'd-1', ownerId: null, roles });
    for (const scenario of ['member', 'suspended'] as const) {
      expect(
        decide('trust.decision.appeal', { ...facts(scenario), resource: decision(['subject']) }),
      ).toEqual({ allowed: true });
    }
    expect(
      decide('trust.decision.appeal', { ...facts('member'), resource: decision([]) }),
    ).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('asks to sign in again for a sensitive action on an old session', () => {
    const stale = {
      ...facts('admin'),
      actor: actor(
        { twoFactorEnabled: true, authenticatedAt: new Date(NOW.getTime() - 3_600_000) },
        ['member', 'admin'],
      ),
    };
    for (const action of [
      'access.roles.manage',
      'trust.project.refund',
      'payment.refund',
      'privacy.erasure.request',
    ] as const) {
      expect(decide(action, stale)).toEqual({
        allowed: false,
        code: 'ACCESS_REAUTHENTICATION_REQUIRED',
        missing: [],
      });
    }
    // Reading stays open on the same session.
    expect(decide('access.roles.read', stale)).toEqual({ allowed: true });
  });

  it('opens collected contributions once KYC and payout account are complete', () => {
    const ready = {
      ...facts('entrepreneur'),
      kycVerified: true,
      missingProvidedElements: ['profile.contributor_facet' as const],
    };
    expect(decide('payment.collection.open', ready)).toEqual({ allowed: true });
    expect(decide('payment.collection.open', { ...ready, kycVerified: false })).toEqual({
      allowed: false,
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['kyc_verified'],
    });
  });
});
