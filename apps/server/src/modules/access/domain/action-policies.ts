import type { Action, AssignableRole, PrerequisiteElement } from '@pitchorium/contracts';

export interface ActionPolicy {
  /** Roles allowed (any of). Absent: every member. Privileged roles also require 2FA. */
  roles?: readonly AssignableRole[];
  /** `self`: the resource must belong to the actor. */
  ownership?: 'self';
  /** Roles the actor must hold on the resource (any of), for example in an organization. */
  resourceRoles?: readonly string[];
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
  // Projects (section 11). The owner of a project has an entrepreneur facet; a resolver gives
  // the role held in the project team (`owner`, `editor`).
  'project.create': { requires: ['profile.entrepreneur_facet'] },
  'project.read': {},
  'project.update': { resourceRoles: ['owner', 'editor'] },
  'project.delete': { resourceRoles: ['owner'], sensitive: true },
  // Cahier des charges 7.2 step 4 and 7.3: verified email and a minimal entrepreneur facet.
  'project.publish': {
    resourceRoles: ['owner'],
    requires: ['email_verified', 'profile.entrepreneur_facet'],
    sensitive: true,
  },
  // An invitation reaches another member: the inviting owner must have proved their email.
  'project.team.manage': { resourceRoles: ['owner'], requires: ['email_verified'] },
  'project.team.leave': { resourceRoles: ['owner', 'editor'] },
  'project.invitation.respond': {},
  'project.updates.publish': { resourceRoles: ['owner', 'editor'], requires: ['email_verified'] },
  // An expression of interest reaches the team: a verified email first.
  'project.interest.express': { requires: ['email_verified'] },
  'project.interest.read': { resourceRoles: ['owner', 'editor'] },
  'project.impact.assess': { resourceRoles: ['owner', 'editor'] },
  // Editorial highlight of the showcase.
  'project.feature': { roles: ['moderator', 'admin'], sensitive: true },
  // Impact (section 12): versions of the methodology are managed by administrators only.
  'impact.methodology.manage': { roles: ['admin'], sensitive: true },
  'impact.assessment.submit': { ownership: 'self', requires: ['profile.entrepreneur_facet'] },
  'impact.assessment.read': { ownership: 'self' },
  // Ownership of the file and the visibility of its resource are checked by the media module.
  'media.upload': {},
  'media.read': {},
  'media.delete': {},
  'organization.read': {},
  // Cahier des charges 7.2: an organization page needs a verified email.
  'organization.create': { requires: ['email_verified'] },
  'organization.update': { resourceRoles: ['owner', 'admin'] },
  'organization.delete': { resourceRoles: ['owner'], sensitive: true },
  'organization.member.invite': { resourceRoles: ['owner', 'admin'], requires: ['email_verified'] },
  'organization.member.manage': { resourceRoles: ['owner', 'admin'] },
  'organization.member.leave': { resourceRoles: ['owner', 'admin', 'member'] },
  'organization.ownership.transfer': { resourceRoles: ['owner'], sensitive: true },
  // The invitation is bound to an email address: the account must have proved its own.
  'organization.invitation.respond': { requires: ['email_verified'] },
  'organization.verification.request': {
    resourceRoles: ['owner'],
    requires: ['email_verified'],
    sensitive: true,
  },
  'organization.verification.review': { roles: ['moderator', 'admin'], sensitive: true },
  // Network (§10.2): reading lists and relationships, following, connecting, blocking.
  'network.read': {},
  'network.follow': {},
  // A connection request reaches another member: the requester must have proved their email.
  'network.connection.request': { requires: ['email_verified'] },
  'network.connection.respond': {},
  'network.connection.remove': {},
  'network.block': {},
  'network.settings.update': {},
  'network.profile-views.read': {},
  // Content (§10.3). A resolver gives the author of the publication or comment as owner.
  'content.feed.read': {},
  'content.post.read': {},
  // Publishing, reposting and commenting reach other members: a verified email first.
  'content.post.create': { requires: ['email_verified'] },
  'content.post.update': { ownership: 'self' },
  'content.post.delete': { ownership: 'self' },
  'content.post.repost': { requires: ['email_verified'] },
  'content.post.save': {},
  'content.post.hide': {},
  // Editorial highlight of the « découverte éditorialisée » (§10.3).
  'content.post.feature': { roles: ['moderator', 'admin'], sensitive: true },
  'content.post.stats.read': { ownership: 'self' },
  'content.reaction.set': {},
  'content.comment.create': { requires: ['email_verified'] },
  'content.comment.update': { ownership: 'self' },
  // The author of the comment, or the author of the publication it belongs to.
  'content.comment.delete': { resourceRoles: ['author', 'post_author'] },
  // Payments (section 9). Quotes and the payment options are read by every member.
  'payment.quote': {},
  // The confirmation is sent by email: a verified email first.
  'payment.contribute': { requires: ['email_verified'] },
  // On behalf of an organization (section 10.7): its owners and admins.
  'payment.contribute.organization': {
    resourceRoles: ['owner', 'admin'],
    requires: ['email_verified'],
    sensitive: true,
  },
  // A resolver gives the contributor as owner of the contribution.
  'payment.contribution.read': { ownership: 'self' },
  'payment.contribution.cancel': { ownership: 'self' },
  // Contributions of a project and their export (section 11.3): the owners of its team.
  'payment.project.contributions.read': { resourceRoles: ['owner'] },
  'payment.project.contributions.export': { resourceRoles: ['owner'], sensitive: true },
  // What a holder completes before collected contributions open (section 9.5); answered by
  // GET /v1/me/prerequisites/payment.collection.open, never required by a route.
  'payment.collection.open': {
    requires: ['email_verified', 'profile.entrepreneur_facet', 'kyc_verified', 'payout_account'],
  },
  'payment.offline.declare': { requires: ['email_verified'] },
  'payment.offline.declare.team': { resourceRoles: ['owner'], requires: ['email_verified'] },
  // The other party confirms or rejects: a resolver gives `contributor` or `holder`.
  'payment.offline.respond': { resourceRoles: ['contributor', 'holder'] },
  'payment.offline.validate': { roles: ['admin'], sensitive: true },
  'payment.payout.configure': {
    requires: ['email_verified', 'profile.entrepreneur_facet'],
    sensitive: true,
  },
  'payment.kyc.submit': {
    requires: ['email_verified', 'profile.entrepreneur_facet'],
    sensitive: true,
  },
  'payment.kyc.review': { roles: ['admin'], sensitive: true },
  'payment.refund': { roles: ['admin'], sensitive: true },
  'payment.reconciliation.manage': { roles: ['admin'], sensitive: true },
  // Engagement (section 9.4): own dashboard, the dashboard of an organization for its members.
  'engagement.dashboard.read': {},
  'engagement.organization.dashboard.read': { resourceRoles: ['owner', 'admin', 'member'] },
  // A time entry reaches its beneficiary: a verified email first.
  'engagement.time.declare': { requires: ['email_verified'] },
  'engagement.time.read': {},
  // A resolver gives `beneficiary` to the entrepreneur or the owners of the project concerned.
  'engagement.time.respond': { resourceRoles: ['beneficiary'] },
  // Messaging (§10.4). Writing out of network needs a verified email (§7.2): checked by the
  // module, which knows whether the members are connected; connected members write freely.
  'messaging.read': {},
  'messaging.conversation.start': {},
  // A resolver gives `participant` to an active participant the conversation shows to.
  'messaging.conversation.participate': { resourceRoles: ['participant'] },
  // A resolver gives `sender` to the author of the message.
  'messaging.message.update': { resourceRoles: ['sender'] },
  'messaging.request.respond': { resourceRoles: ['request_recipient'] },
  'messaging.settings.update': {},
  // An introduction reaches two other members: a verified email first.
  'messaging.introduction.propose': { requires: ['email_verified'] },
  // A resolver gives `introduced` to the two members introduced.
  'messaging.introduction.respond': { resourceRoles: ['introduced'] },
  // Notifications (§10.5): the member's own.
  'notifications.read': {},
  'notifications.manage': {},
  'notifications.preferences.update': {},
};
