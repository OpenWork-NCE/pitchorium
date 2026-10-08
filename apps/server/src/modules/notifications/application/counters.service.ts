import { Injectable } from '@nestjs/common';
import { type Counters, SERVER_EVENTS } from '@pitchorium/contracts';
import { RealtimePublisher } from '../../../platform/realtime';
import { IdentityFacade } from '../../identity';
import { MessagingFacade } from '../../messaging';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import { ProjectsFacade } from '../../projects';
import { inGroups } from './in-groups';
import { NotificationsRepository } from './ports';

/** Members whose counters are computed at once (database connections in use). */
const PARALLEL_MEMBERS = 8;

/**
 * Unified counters (§10.5): unread notifications and messages, message requests and pending
 * invitations, read through the facades; pushed in real time on each change.
 */
@Injectable()
export class CountersService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly messaging: MessagingFacade,
    private readonly network: NetworkFacade,
    private readonly projects: ProjectsFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly identity: IdentityFacade,
    private readonly publisher: RealtimePublisher,
  ) {}

  async of(userId: string): Promise<Counters> {
    const user = await this.identity.findUser(userId);
    const [
      notifications,
      messages,
      messageRequests,
      connections,
      introductions,
      projects,
      organizations,
    ] = await Promise.all([
      this.notifications.countUnread(userId),
      this.messaging.unreadSummary(userId),
      this.messaging.pendingRequests(userId),
      this.network.pendingConnectionRequests(userId),
      this.messaging.introductionsAwaiting(userId),
      this.projects.pendingInvitations(userId),
      user?.emailVerified ? this.organizations.pendingInvitationsTo(user.email) : 0,
    ]);
    return {
      notifications,
      messages: { unread: messages.messages, conversations: messages.conversations },
      messageRequests,
      invitations: { connections, introductions, projects, organizations },
    };
  }

  async push(userIds: readonly string[]): Promise<void> {
    await inGroups([...new Set(userIds)], PARALLEL_MEMBERS, async (userId) => {
      this.publisher.toUsers([userId], SERVER_EVENTS.counters, { counters: await this.of(userId) });
    });
  }
}
