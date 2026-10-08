import type {
  NotificationChannel,
  NotificationPriority,
  NotificationTargetType,
  NotificationType,
} from '@pitchorium/contracts';

/**
 * How events join one notification (ADR 0059): `target`, every event on the same target in the
 * window (« Amina et 12 autres ont réagi à votre publication ») ; `type`, every event of the
 * type in the window (« ... vous suivent ») ; `none`, one notification per event.
 */
export type Grouping = 'target' | 'type' | 'none';

export interface NotificationTypeDefinition {
  /** Source events (`<module>.<aggregate>.<fact>.v1`) or scheduled sources. */
  sources: readonly string[];
  /** Security, payments, KYC, legal terms: always sent on their default channels (ADR 0060). */
  transactional: boolean;
  priority: NotificationPriority;
  /** Channels when the member has not chosen; provisional (docs/open-questions.md). */
  defaults: Readonly<Record<NotificationChannel, boolean>>;
  grouping: Grouping;
  target: NotificationTargetType;
  /**
   * The email of a `message` is the copy of unread messages after a delay (§10.4), never a
   * notification email.
   */
  emailAsUnreadCopy?: true;
}

const on = { in_app: true, email: true } as const;
const inApp = { in_app: true, email: false } as const;

/**
 * Types whose email is sent by the emitting module (transactional emails with a token or
 * about the account): the notification stays in the app, so the email is never sent twice.
 */
export const EMAILED_BY_EMITTING_MODULE: readonly NotificationType[] = [
  'organization_invitation',
  'organization_role_changed',
  'organization_ownership_transferred',
  'organization_verification_decided',
  'security_alert',
];

/** Registry of the notification types: one entry per type of the contracts. */
export const NOTIFICATION_DEFINITIONS: Readonly<
  Record<NotificationType, NotificationTypeDefinition>
> = {
  connection_request: {
    sources: ['network.connection.requested.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'type',
    target: 'connection_requests',
  },
  connection_accepted: {
    sources: ['network.connection.accepted.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'type',
    target: 'member',
  },
  new_follower: {
    sources: ['network.follow.created.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'type',
    target: 'member',
  },
  reaction: {
    sources: ['content.reaction.added.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'post',
  },
  comment: {
    sources: ['content.comment.created.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'target',
    target: 'post',
  },
  mention: {
    sources: ['content.mention.created.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'target',
    target: 'post',
  },
  followed_post: {
    sources: ['content.post.created.v1'],
    transactional: false,
    priority: 'low',
    defaults: inApp,
    grouping: 'type',
    target: 'post',
  },
  message: {
    sources: ['messaging.message.sent.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'conversation',
    emailAsUnreadCopy: true,
  },
  message_request: {
    sources: ['messaging.conversation.created.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'type',
    target: 'message_requests',
  },
  message_request_accepted: {
    sources: ['messaging.conversation.request-accepted.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'conversation',
  },
  introduction_proposed: {
    sources: ['messaging.introduction.proposed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'introduction',
  },
  introduction_completed: {
    sources: ['messaging.introduction.completed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'conversation',
  },
  introduction_declined: {
    sources: ['messaging.introduction.declined.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'introduction',
  },
  profile_views: {
    sources: ['scheduled: profile views of the previous UTC day'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'profile_views',
  },
  project_contribution: {
    sources: ['payments.contribution.succeeded.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'target',
    target: 'project',
  },
  tier_unlocked: {
    sources: ['projects.tier.unlocked.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'project',
  },
  project_update: {
    sources: ['projects.update.published.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'project',
  },
  project_ending_soon: {
    sources: ['projects.project.ending-soon.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'project',
  },
  project_funded: {
    sources: ['projects.project.funded.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'project',
  },
  project_closed: {
    sources: ['projects.project.closed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'project',
  },
  project_interest: {
    sources: ['projects.interest.expressed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'target',
    target: 'project',
  },
  project_team_invitation: {
    sources: ['projects.team.member-invited.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'project_invitations',
  },
  project_team_joined: {
    sources: ['projects.team.member-added.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'project',
  },
  project_team_invitation_declined: {
    sources: ['projects.team.invitation-declined.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'project',
  },
  // Organizations send these transactional emails themselves (invitation token, rights,
  // verification): in-app only here, never turned off, never emailed twice.
  organization_invitation: {
    sources: ['organizations.member.invited.v1'],
    transactional: true,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization_invitations',
  },
  // Not transactional: emailed here, with the preferences and the one-click unsubscribe.
  organization_member_joined: {
    sources: ['organizations.member.joined.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'target',
    target: 'organization',
  },
  organization_role_changed: {
    sources: ['organizations.member.role-changed.v1'],
    transactional: true,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization',
  },
  organization_ownership_transferred: {
    sources: ['organizations.ownership.transferred.v1'],
    transactional: true,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization',
  },
  organization_verification_decided: {
    sources: [
      'organizations.verification.approved.v1',
      'organizations.verification.rejected.v1',
      'organizations.verification.revoked.v1',
    ],
    transactional: true,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization',
  },
  kyc_decided: {
    sources: ['payments.kyc.approved.v1', 'payments.kyc.rejected.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'payout_account',
  },
  contribution_refunded: {
    sources: ['payments.contribution.refunded.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'contribution',
  },
  offline_contribution_declared: {
    sources: ['payments.offline-contribution.declared.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'offline_contribution',
  },
  offline_contribution_decided: {
    sources: [
      'payments.offline-contribution.confirmed.v1',
      'payments.offline-contribution.validated.v1',
      'payments.offline-contribution.rejected.v1',
    ],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'offline_contribution',
  },
  time_entry_declared: {
    sources: ['engagement.time-entry.declared.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'type',
    target: 'time_entry',
  },
  time_entry_answered: {
    sources: ['engagement.time-entry.confirmed.v1', 'engagement.time-entry.disputed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'time_entry',
  },
  // Identity sends the security emails itself: in-app only, never turned off.
  security_alert: {
    sources: [
      'identity.account.linked.v1',
      'identity.account.unlinked.v1',
      'identity.user.password-changed.v1',
    ],
    transactional: true,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'account_security',
  },
  // Events (§14, scope to validate): registration, waiting list, reminder, cancellation.
  event_registration_confirmed: {
    sources: ['events.registration.created.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'event',
  },
  event_waitlist_promoted: {
    sources: ['events.registration.promoted.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'event',
  },
  event_reminder: {
    sources: ['scheduled: events starting within NOTIFICATIONS_EVENT_REMINDER_HOURS'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'event',
  },
  event_canceled: {
    sources: ['events.event.canceled.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'event',
  },
  // Missions (§6.3, §14): application or solicitation, answer, completion to confirm.
  mission_engagement_requested: {
    sources: ['missions.engagement.requested.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'mission_engagement',
  },
  mission_engagement_answered: {
    sources: ['missions.engagement.accepted.v1', 'missions.engagement.declined.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'mission_engagement',
  },
  mission_completed: {
    sources: ['missions.engagement.completed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'mission_engagement',
  },
  // Discovery: new explained suggestions, low priority and grouped.
  new_suggestions: {
    sources: ['scheduled: suggestions that appeared on the previous UTC day'],
    transactional: false,
    priority: 'low',
    defaults: inApp,
    grouping: 'type',
    target: 'suggestions',
  },
  // Trust and safety (§13): receipt and outcome of a report, statement of reasons of a
  // decision, suspension, appeal. Transactional: the member cannot turn them off.
  report_received: {
    sources: ['trust.report.created.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'reports',
  },
  report_resolved: {
    sources: ['trust.report.resolved.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'reports',
  },
  moderation_decision: {
    sources: ['trust.decision.taken.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'moderation_decision',
  },
  suspension_started: {
    sources: ['trust.suspension.started.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'moderation',
  },
  suspension_ended: {
    sources: ['trust.suspension.ended.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'moderation',
  },
  appeal_received: {
    sources: ['trust.decision.appealed.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'moderation_decision',
  },
  appeal_decided: {
    sources: ['trust.decision.appeal-resolved.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'moderation_decision',
  },
  // Rights of the GDPR (§13): archive ready, erasure scheduled, reminder before it. The
  // confirmation of the erasure is emailed by the privacy module, the account being gone.
  export_ready: {
    sources: ['privacy.export.ready.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'privacy',
  },
  erasure_scheduled: {
    sources: ['privacy.erasure.requested.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'privacy',
  },
  erasure_reminder: {
    sources: ['privacy.erasure.reminder-due.v1'],
    transactional: true,
    priority: 'normal',
    defaults: on,
    grouping: 'none',
    target: 'privacy',
  },
};

/** Route of the web app a notification opens (docs/architecture/notifications.md). */
export function pathOf(type: NotificationTargetType, key: string): string {
  switch (type) {
    case 'member':
      return `/members/${key}`;
    case 'post':
      return `/posts/${key}`;
    case 'conversation':
      return `/messages/${key}`;
    case 'message_requests':
      return '/messages/requests';
    case 'introduction':
      return `/introductions/${key}`;
    case 'project':
      return `/projects/${key}`;
    case 'project_invitations':
      return '/me/project-invitations';
    case 'organization':
      return `/organizations/${key}`;
    case 'organization_invitations':
      return '/me/organization-invitations';
    case 'contribution':
      return `/me/contributions/${key}`;
    case 'payout_account':
      return '/me/payout-account';
    case 'offline_contribution':
      return `/me/offline-contributions/${key}`;
    case 'time_entry':
      return `/me/time-entries/${key}`;
    case 'profile_views':
      return '/me/profile-views';
    case 'connection_requests':
      return '/network/requests';
    case 'account_security':
      return '/me/security';
    case 'event':
      return `/events/${key}`;
    case 'mission_engagement':
      return `/missions/engagements/${key}`;
    case 'suggestions':
      return '/discover';
    case 'reports':
      return '/me/reports';
    case 'moderation_decision':
      return `/me/moderation/decisions/${key}`;
    case 'moderation':
      return '/me/moderation';
    case 'privacy':
      return '/me/privacy';
  }
}
