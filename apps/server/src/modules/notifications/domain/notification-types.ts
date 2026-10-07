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
  // Organizations send their own emails (invitation token, decisions): in-app only.
  organization_invitation: {
    sources: ['organizations.member.invited.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization_invitations',
  },
  organization_member_joined: {
    sources: ['organizations.member.joined.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'target',
    target: 'organization',
  },
  organization_role_changed: {
    sources: ['organizations.member.role-changed.v1'],
    transactional: false,
    priority: 'normal',
    defaults: inApp,
    grouping: 'none',
    target: 'organization',
  },
  organization_ownership_transferred: {
    sources: ['organizations.ownership.transferred.v1'],
    transactional: false,
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
    transactional: false,
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
  }
}
