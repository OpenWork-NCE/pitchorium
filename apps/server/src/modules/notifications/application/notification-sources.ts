import { Injectable } from '@nestjs/common';
import type { NotificationTargetType, NotificationType } from '@pitchorium/contracts';
import type { OutboxEnvelope } from '../../../platform/outbox';
import {
  CommentCreated,
  ContentFacade,
  MentionCreated,
  PostCreated,
  ReactionAdded,
} from '../../content';
import { TimeEntryConfirmed, TimeEntryDeclared, TimeEntryDisputed } from '../../engagement';
import {
  EventCanceled,
  EventsFacade,
  RegistrationCreated,
  RegistrationPromoted,
} from '../../events';
import { AccountLinked, AccountUnlinked, IdentityFacade, PasswordChanged } from '../../identity';
import {
  ConversationCreated,
  ConversationRequestAccepted,
  IntroductionCompleted,
  IntroductionDeclined,
  IntroductionProposed,
  MessageSent,
  MessagingFacade,
} from '../../messaging';
import {
  EngagementAccepted,
  EngagementCompleted,
  EngagementDeclined,
  EngagementRequested,
  MissionsFacade,
} from '../../missions';
import { ConnectionAccepted, ConnectionRequested, FollowCreated } from '../../network';
import {
  MemberInvited,
  MemberJoined,
  MemberRoleChanged,
  OrganizationsFacade,
  OwnershipTransferred,
  VerificationApproved,
  VerificationRejected,
  VerificationRevoked,
} from '../../organizations';
import {
  ContributionRefunded,
  ContributionSucceeded,
  KycApproved,
  KycRejected,
  OfflineContributionConfirmed,
  OfflineContributionDeclared,
  OfflineContributionRejected,
  OfflineContributionValidated,
  PaymentsFacade,
} from '../../payments';
import { ErasureReminderDue, ErasureRequested, ExportReady } from '../../privacy';
import { ProfilesFacade } from '../../profiles';
import {
  AppealResolved,
  DecisionAppealed,
  DecisionTaken,
  ReportCreated,
  ReportResolved,
  SuspensionEnded,
  SuspensionStarted,
  TrustFacade,
} from '../../trust';
import {
  InterestExpressed,
  PROJECT_FOLLOW_TARGET,
  ProjectClosed,
  ProjectEndingSoon,
  ProjectFunded,
  ProjectsFacade,
  TeamInvitationDeclined,
  TeamMemberAdded,
  TeamMemberInvited,
  TierUnlocked,
  UpdatePublished,
} from '../../projects';
import type { Dispatch } from './notification-creator';
import type { NotificationData } from './ports';

/** Followers of a target notified by batches in the worker (ADR 0059). */
export interface Fanout {
  type: NotificationType;
  followersOf: { targetType: string; targetId: string };
  /** Keep only the followers connected to this member (publication for connections). */
  connectionsOf?: string;
  actorId: string | null;
  target: { type: NotificationTargetType; key: string };
  data?: NotificationData;
}

export interface Resolution {
  dispatches: Dispatch[];
  fanouts: Fanout[];
}

const MEMBER_TARGET = 'member';
const ORGANIZATION_TARGET = 'organization';

/** Source events of the notifications: the handler subscribes to all of them. */
export const SOURCE_EVENT_TYPES: readonly string[] = [
  ConnectionRequested.TYPE,
  ConnectionAccepted.TYPE,
  FollowCreated.TYPE,
  ReactionAdded.TYPE,
  CommentCreated.TYPE,
  MentionCreated.TYPE,
  PostCreated.TYPE,
  MessageSent.TYPE,
  ConversationCreated.TYPE,
  ConversationRequestAccepted.TYPE,
  IntroductionProposed.TYPE,
  IntroductionCompleted.TYPE,
  IntroductionDeclined.TYPE,
  ContributionSucceeded.TYPE,
  TierUnlocked.TYPE,
  UpdatePublished.TYPE,
  ProjectEndingSoon.TYPE,
  ProjectFunded.TYPE,
  ProjectClosed.TYPE,
  InterestExpressed.TYPE,
  TeamMemberInvited.TYPE,
  TeamMemberAdded.TYPE,
  TeamInvitationDeclined.TYPE,
  MemberInvited.TYPE,
  MemberJoined.TYPE,
  MemberRoleChanged.TYPE,
  OwnershipTransferred.TYPE,
  VerificationApproved.TYPE,
  VerificationRejected.TYPE,
  VerificationRevoked.TYPE,
  KycApproved.TYPE,
  KycRejected.TYPE,
  ContributionRefunded.TYPE,
  OfflineContributionDeclared.TYPE,
  OfflineContributionConfirmed.TYPE,
  OfflineContributionValidated.TYPE,
  OfflineContributionRejected.TYPE,
  TimeEntryDeclared.TYPE,
  TimeEntryConfirmed.TYPE,
  TimeEntryDisputed.TYPE,
  AccountLinked.TYPE,
  AccountUnlinked.TYPE,
  PasswordChanged.TYPE,
  RegistrationCreated.TYPE,
  RegistrationPromoted.TYPE,
  EventCanceled.TYPE,
  EngagementRequested.TYPE,
  EngagementAccepted.TYPE,
  EngagementDeclined.TYPE,
  EngagementCompleted.TYPE,
  ExportReady.TYPE,
  ErasureRequested.TYPE,
  ErasureReminderDue.TYPE,
  ReportCreated.TYPE,
  ReportResolved.TYPE,
  DecisionTaken.TYPE,
  DecisionAppealed.TYPE,
  AppealResolved.TYPE,
  SuspensionStarted.TYPE,
  SuspensionEnded.TYPE,
];

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const none: Resolution = { dispatches: [], fanouts: [] };

/**
 * Recipient resolvers of the notification types (ADR 0059): from a source event to the members
 * to notify, read through the facades of the emitting modules. Followers of a target are
 * notified by batches (fan-out), everything else at once.
 */
const nullable = (value: unknown): string | null => (typeof value === 'string' ? value : null);

@Injectable()
export class NotificationSources {
  constructor(
    private readonly profiles: ProfilesFacade,
    private readonly content: ContentFacade,
    private readonly messaging: MessagingFacade,
    private readonly projects: ProjectsFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly payments: PaymentsFacade,
    private readonly identity: IdentityFacade,
    private readonly events: EventsFacade,
    private readonly missions: MissionsFacade,
    private readonly trust: TrustFacade,
  ) {}

  async resolve(event: OutboxEnvelope): Promise<Resolution> {
    const p = event.payload;
    const id = event.aggregateId;
    switch (event.type) {
      case ConnectionRequested.TYPE:
        // The request travels with its notification: it is accepted or declined from there.
        return this.direct(
          'connection_request',
          [text(p['addresseeId'])],
          text(p['requesterId']),
          { type: 'connection_requests', key: 'received' },
          { requestId: id },
        );
      case ConnectionAccepted.TYPE: {
        const addresseeId = text(p['addresseeId']);
        return this.direct('connection_accepted', [text(p['requesterId'])], addresseeId, {
          type: 'member',
          key: await this.handleOf(addresseeId),
        });
      }
      case FollowCreated.TYPE:
        if (p['targetType'] !== MEMBER_TARGET || p['origin'] !== 'manual') return none;
        return this.direct('new_follower', [text(p['targetId'])], id, {
          type: 'member',
          key: await this.handleOf(id),
        });
      case ReactionAdded.TYPE: {
        const postId = p['targetType'] === 'comment' ? await this.content.commentPostId(id) : id;
        if (!postId) return none;
        return this.direct(
          'reaction',
          [text(p['targetAuthorId'])],
          text(p['userId']),
          { type: 'post', key: postId },
          { reaction: text(p['reaction']), on: text(p['targetType']) },
        );
      }
      case CommentCreated.TYPE:
        return this.direct(
          'comment',
          [text(p['postAuthorId'])],
          text(p['authorId']),
          { type: 'post', key: text(p['postId']) ?? '' },
          { commentId: id, reply: p['parentId'] !== null },
        );
      case MentionCreated.TYPE:
        if (p['targetType'] !== MEMBER_TARGET) return none;
        return this.direct('mention', [text(p['targetId'])], text(p['authorId']), {
          type: 'post',
          key: id,
        });
      case PostCreated.TYPE:
        return this.followedPost(id, p);
      case MessageSent.TYPE:
        return this.message(p);
      case ConversationCreated.TYPE: {
        if (p['status'] !== 'request') return none;
        const createdBy = text(p['createdBy']);
        const participants = Array.isArray(p['participantIds']) ? p['participantIds'] : [];
        return this.direct(
          'message_request',
          participants.map(text).filter((user) => user !== createdBy),
          createdBy,
          { type: 'message_requests', key: 'requests' },
        );
      }
      case ConversationRequestAccepted.TYPE:
        if (p['reason'] !== 'answer') return none;
        return this.direct(
          'message_request_accepted',
          [text(p['requesterId'])],
          text(p['recipientId']),
          { type: 'conversation', key: id },
        );
      case IntroductionProposed.TYPE:
        return this.direct(
          'introduction_proposed',
          [text(p['firstId']), text(p['secondId'])],
          text(p['introducerId']),
          { type: 'introduction', key: id },
        );
      case IntroductionCompleted.TYPE:
        return this.direct(
          'introduction_completed',
          [text(p['introducerId']), text(p['firstId']), text(p['secondId'])],
          null,
          { type: 'conversation', key: text(p['conversationId']) ?? '' },
        );
      case IntroductionDeclined.TYPE:
        // The introducer learns that it did not go through, not who declined.
        return this.direct('introduction_declined', [text(p['introducerId'])], null, {
          type: 'introduction',
          key: id,
        });
      case ContributionSucceeded.TYPE:
        return this.contribution(id);
      case TierUnlocked.TYPE:
        return this.projectNews(id, 'tier_unlocked', null, {
          position: typeof p['position'] === 'number' ? p['position'] : null,
        });
      case UpdatePublished.TYPE:
        return this.projectNews(id, 'project_update', text(p['authorId']), {
          updateId: text(p['updateId']),
        });
      case ProjectEndingSoon.TYPE:
        return this.projectNews(id, 'project_ending_soon', null);
      case ProjectFunded.TYPE:
        return this.projectNews(id, 'project_funded', null);
      case ProjectClosed.TYPE:
        return this.projectNews(id, 'project_closed', null, {
          goalReached: p['goalReached'] === true,
        });
      case InterestExpressed.TYPE:
        return this.toTeam(id, 'project_interest', text(p['userId']), ['owner', 'editor'], {
          kind: text(p['kind']),
        });
      case TeamMemberInvited.TYPE: {
        const project = await this.project(id);
        if (!project) return none;
        return this.direct(
          'project_team_invitation',
          [text(p['userId'])],
          text(p['invitedBy']),
          { type: 'project_invitations', key: project.slug },
          { title: project.title, role: text(p['role']) },
        );
      }
      case TeamMemberAdded.TYPE:
        return this.toTeam(id, 'project_team_joined', text(p['userId']), ['owner'], {
          role: text(p['role']),
        });
      case TeamInvitationDeclined.TYPE:
        return this.toTeam(id, 'project_team_invitation_declined', text(p['userId']), ['owner']);
      case MemberInvited.TYPE:
        return this.organizationInvitation(id, p);
      case MemberJoined.TYPE:
        return this.toOrganization(id, 'organization_member_joined', text(p['userId']), null, {
          role: text(p['role']),
        });
      case MemberRoleChanged.TYPE:
        return this.toOrganization(
          id,
          'organization_role_changed',
          text(p['by']),
          [text(p['userId'])],
          { role: text(p['role']), previousRole: text(p['previousRole']) },
        );
      case OwnershipTransferred.TYPE:
        return this.toOrganization(id, 'organization_ownership_transferred', null, [
          text(p['fromUserId']),
          text(p['toUserId']),
        ]);
      case VerificationApproved.TYPE:
      case VerificationRejected.TYPE:
      case VerificationRevoked.TYPE:
        return this.toOrganization(id, 'organization_verification_decided', null, null, {
          decision: event.type.split('.')[2] ?? null,
        });
      case KycApproved.TYPE:
      case KycRejected.TYPE:
        return this.direct(
          'kyc_decided',
          [id],
          null,
          { type: 'payout_account', key: 'kyc' },
          { decision: event.type === KycApproved.TYPE ? 'approved' : 'rejected' },
        );
      case ContributionRefunded.TYPE: {
        const [facts] = await this.payments.contributionFacts([id]);
        const project = await this.project(text(p['projectId']));
        if (!facts) return none;
        return this.direct(
          'contribution_refunded',
          [facts.contributorId],
          null,
          { type: 'contribution', key: id },
          { title: project?.title ?? null, full: p['full'] === true },
        );
      }
      case OfflineContributionDeclared.TYPE:
      case OfflineContributionConfirmed.TYPE:
      case OfflineContributionValidated.TYPE:
      case OfflineContributionRejected.TYPE:
        return this.offline(id, event.type, text(p['by']));
      case TimeEntryDeclared.TYPE: {
        // The time of a mission is announced by `mission_completed`, not twice.
        if (text(p['missionEngagementId'])) return none;
        const projectId = text(p['projectId']);
        const beneficiaries = projectId
          ? await this.projects.teamMemberIds(projectId, ['owner'])
          : [text(p['entrepreneurId'])];
        return this.direct('time_entry_declared', beneficiaries, text(p['contributorId']), {
          type: 'time_entry',
          key: id,
        });
      }
      case TimeEntryConfirmed.TYPE:
      case TimeEntryDisputed.TYPE:
        return this.direct(
          'time_entry_answered',
          [text(p['contributorId'])],
          text(p['by']),
          { type: 'time_entry', key: id },
          { answer: event.type === TimeEntryConfirmed.TYPE ? 'confirmed' : 'disputed' },
        );
      case AccountLinked.TYPE:
      case AccountUnlinked.TYPE:
      case PasswordChanged.TYPE:
        return this.direct(
          'security_alert',
          [id],
          null,
          { type: 'account_security', key: 'security' },
          { change: event.type.split('.')[2] ?? null, provider: text(p['provider']) },
        );
      case RegistrationCreated.TYPE:
        return this.toEventMembers(id, 'event_registration_confirmed', [text(p['userId'])], {
          waitlisted: p['status'] === 'waitlisted',
        });
      case RegistrationPromoted.TYPE:
        return this.toEventMembers(id, 'event_waitlist_promoted', [text(p['userId'])]);
      case EventCanceled.TYPE:
        return this.toEventMembers(
          id,
          'event_canceled',
          await this.events.attendeeIds(id, ['registered', 'waitlisted']),
        );
      case EngagementRequested.TYPE:
        return this.missionEngagement(id, 'mission_engagement_requested', 'responder');
      case EngagementAccepted.TYPE:
      case EngagementDeclined.TYPE:
        return this.missionEngagement(id, 'mission_engagement_answered', 'requester', {
          answer: event.type === EngagementAccepted.TYPE ? 'accepted' : 'declined',
        });
      case EngagementCompleted.TYPE:
        return this.missionEngagement(id, 'mission_completed', 'beneficiary');
      case ExportReady.TYPE:
        return this.direct(
          'export_ready',
          [text(p['userId'])],
          null,
          { type: 'privacy', key: id },
          { expiresAt: text(p['expiresAt']) },
        );
      case ErasureRequested.TYPE:
      case ErasureReminderDue.TYPE:
        return this.direct(
          event.type === ErasureRequested.TYPE ? 'erasure_scheduled' : 'erasure_reminder',
          [text(p['userId'])],
          null,
          { type: 'privacy', key: id },
          { scheduledFor: text(p['scheduledFor']) },
        );
      case ReportCreated.TYPE:
        return this.direct(
          'report_received',
          [nullable(p['reporterId'])],
          null,
          {
            type: 'reports',
            key: id,
          },
          { targetType: text(p['targetType']), reason: text(p['reason']) },
        );
      case ReportResolved.TYPE:
        return this.direct(
          'report_resolved',
          [nullable(p['reporterId'])],
          null,
          {
            type: 'reports',
            key: id,
          },
          { outcome: text(p['outcome']) },
        );
      case DecisionTaken.TYPE:
        return this.decision(id);
      case DecisionAppealed.TYPE:
        return this.direct('appeal_received', [text(p['appellantId'])], null, {
          type: 'moderation_decision',
          key: id,
        });
      case AppealResolved.TYPE:
        return this.direct(
          'appeal_decided',
          [text(p['appellantId'])],
          null,
          { type: 'moderation_decision', key: id },
          { outcome: text(p['outcome']), detail: await this.trust.appealOutcome(id) },
        );
      case SuspensionStarted.TYPE:
        return this.direct(
          'suspension_started',
          [text(p['userId'])],
          null,
          { type: 'moderation', key: 'standing' },
          { decisionId: text(p['decisionId']), endsAt: nullable(p['endsAt']) },
        );
      case SuspensionEnded.TYPE:
        return this.direct(
          'suspension_ended',
          [text(p['userId'])],
          null,
          { type: 'moderation', key: 'standing' },
          { cause: text(p['cause']) },
        );
      default:
        return none;
    }
  }

  /**
   * Statement of reasons of a decision for the member concerned, in the notification and its
   * email; a dismissal restricts nothing and is not notified to them.
   */
  private async decision(decisionId: string): Promise<Resolution> {
    const notice = await this.trust.decisionNotice(decisionId);
    if (!notice || notice.kind === 'dismiss') return none;
    return this.direct(
      'moderation_decision',
      [notice.subjectId],
      null,
      { type: 'moderation_decision', key: decisionId },
      {
        kind: notice.kind,
        reason: notice.reason,
        detail: notice.statement,
        appealableUntil: notice.appealableUntil?.toISOString() ?? null,
      },
    );
  }

  /** Members of an event: the registrant, or the attendees of a canceled event. */
  private async toEventMembers(
    eventId: string,
    type: NotificationType,
    recipients: readonly (string | null)[],
    data: NotificationData = {},
  ): Promise<Resolution> {
    const event = (await this.events.summaries([eventId])).get(eventId);
    if (!event) return none;
    return this.direct(
      type,
      recipients,
      null,
      { type: 'event', key: event.slug },
      { title: event.title, ...data },
    );
  }

  /**
   * One side of a mission engagement, the other side as actor: the author who must answer, the
   * member who asked, or the beneficiary who confirms the hours (owners of the project).
   */
  private async missionEngagement(
    engagementId: string,
    type: NotificationType,
    to: 'responder' | 'requester' | 'beneficiary',
    data: NotificationData = {},
  ): Promise<Resolution> {
    const parties = await this.missions.engagementParties(engagementId);
    if (!parties) return none;
    const target = { type: 'mission_engagement' as const, key: engagementId };
    const withTitle = { title: parties.title, ...data };
    switch (to) {
      case 'responder':
        return this.direct(type, [parties.responderId], parties.requesterId, target, withTitle);
      case 'requester':
        return this.direct(type, [parties.requesterId], parties.responderId, target, withTitle);
      case 'beneficiary':
        return this.direct(
          type,
          parties.projectId
            ? await this.projects.teamMemberIds(parties.projectId, ['owner'])
            : [parties.beneficiaryId],
          parties.expertId,
          target,
          withTitle,
        );
    }
  }

  private direct(
    type: NotificationType,
    recipients: readonly (string | null)[],
    actorId: string | null,
    target: { type: NotificationTargetType; key: string },
    data: NotificationData = {},
  ): Resolution {
    const recipientIds = recipients.filter((value): value is string => value !== null);
    return { dispatches: [{ type, recipientIds, actorId, target, data }], fanouts: [] };
  }

  /** Followers of the author (member or organization), connections only for such a post. */
  private followedPost(postId: string, p: OutboxEnvelope['payload']): Resolution {
    const authorId = text(p['authorId']);
    const organizationId = text(p['organizationId']);
    if (!authorId) return none;
    const followersOf = organizationId
      ? { targetType: ORGANIZATION_TARGET, targetId: organizationId }
      : { targetType: MEMBER_TARGET, targetId: authorId };
    return {
      dispatches: [],
      fanouts: [
        {
          type: 'followed_post',
          followersOf,
          ...(p['visibility'] === 'connections' ? { connectionsOf: authorId } : {}),
          actorId: authorId,
          target: { type: 'post', key: postId },
          data: { organizationId },
        },
      ],
    };
  }

  /** In-app notification of a message; no notification for a request (it has its own). */
  private async message(p: OutboxEnvelope['payload']): Promise<Resolution> {
    const conversationId = text(p['conversationId']);
    if (!conversationId || !(await this.messaging.isActive(conversationId))) return none;
    const recipients = Array.isArray(p['recipientIds']) ? p['recipientIds'].map(text) : [];
    const audible: string[] = [];
    for (const recipientId of recipients) {
      if (!recipientId) continue;
      const state = await this.messaging.unreadState(recipientId, conversationId);
      if (state && !state.muted) audible.push(recipientId);
    }
    return this.direct('message', audible, text(p['senderId']), {
      type: 'conversation',
      key: conversationId,
    });
  }

  /** To the owners of the project; the contributor is named only when they agreed to it. */
  private async contribution(contributionId: string): Promise<Resolution> {
    const [facts] = await this.payments.contributionFacts([contributionId]);
    if (!facts) return none;
    return this.toTeam(
      facts.projectId,
      'project_contribution',
      facts.named ? facts.contributorId : null,
      ['owner'],
    );
  }

  /** The team, the contributors and the followers of the project. */
  private async projectNews(
    projectId: string,
    type: NotificationType,
    actorId: string | null,
    data: NotificationData = {},
  ): Promise<Resolution> {
    const project = await this.project(projectId);
    if (!project) return none;
    const target = { type: 'project' as const, key: project.slug };
    const withTitle = { title: project.title, ...data };
    const followers = type !== 'project_closed';
    const [team, contributors] = await Promise.all([
      type === 'project_update' || type === 'project_ending_soon'
        ? Promise.resolve([])
        : this.projects.teamMemberIds(projectId),
      type === 'project_update' ? Promise.resolve([]) : this.payments.contributorIds(projectId),
    ]);
    return {
      dispatches: [
        { type, recipientIds: [...team, ...contributors], actorId, target, data: withTitle },
      ],
      fanouts: followers
        ? [
            {
              type,
              followersOf: { targetType: PROJECT_FOLLOW_TARGET, targetId: projectId },
              actorId,
              target,
              data: withTitle,
            },
          ]
        : [],
    };
  }

  private async toTeam(
    projectId: string,
    type: NotificationType,
    actorId: string | null,
    roles: readonly ('owner' | 'editor')[],
    data: NotificationData = {},
  ): Promise<Resolution> {
    const project = await this.project(projectId);
    if (!project) return none;
    return this.direct(
      type,
      await this.projects.teamMemberIds(projectId, roles),
      actorId,
      { type: 'project', key: project.slug },
      { title: project.title, ...data },
    );
  }

  /** To the given members, or to the owners and admins of the organization. */
  private async toOrganization(
    organizationId: string,
    type: NotificationType,
    actorId: string | null,
    recipients: readonly (string | null)[] | null,
    data: NotificationData = {},
  ): Promise<Resolution> {
    const organization = (await this.organizations.summaries([organizationId])).get(organizationId);
    if (!organization) return none;
    return this.direct(
      type,
      recipients ?? (await this.organizations.memberIds(organizationId)),
      actorId,
      { type: 'organization', key: organization.slug },
      { title: organization.name, ...data },
    );
  }

  /** In-app only, to an existing account of the invited address (organizations emails it). */
  private async organizationInvitation(
    organizationId: string,
    p: OutboxEnvelope['payload'],
  ): Promise<Resolution> {
    const invitationId = text(p['invitationId']);
    const invitation = invitationId ? await this.organizations.invitation(invitationId) : null;
    const user = invitation ? await this.identity.findUserByEmail(invitation.email) : null;
    if (!user?.emailVerified) return none;
    const organization = (await this.organizations.summaries([organizationId])).get(organizationId);
    if (!organization) return none;
    return this.direct(
      'organization_invitation',
      [user.id],
      text(p['invitedBy']),
      { type: 'organization_invitations', key: organization.slug },
      { title: organization.name, role: text(p['role']) },
    );
  }

  /** The other party of an off-platform contribution, or both after a decision. */
  private async offline(id: string, type: string, by: string | null): Promise<Resolution> {
    const parties = await this.payments.offlineParties(id);
    const project = parties ? await this.project(parties.projectId) : null;
    if (!parties || !project) return none;
    const holders = await this.projects.teamMemberIds(parties.projectId, ['owner']);
    const declared = type === OfflineContributionDeclared.TYPE;
    const recipients = declared
      ? parties.declaredBy === 'contributor'
        ? holders
        : [parties.contributorId]
      : [parties.contributorId, ...holders];
    return this.direct(
      declared ? 'offline_contribution_declared' : 'offline_contribution_decided',
      recipients.filter((userId) => userId !== by),
      null,
      { type: 'offline_contribution', key: id },
      { title: project.title, decision: declared ? null : (type.split('.')[2] ?? null) },
    );
  }

  private async project(projectId: string | null) {
    return projectId ? this.projects.fundable(projectId) : null;
  }

  private async handleOf(userId: string | null): Promise<string> {
    if (!userId) return '';
    return (await this.profiles.memberCards([userId])).get(userId)?.handle ?? '';
  }
}
