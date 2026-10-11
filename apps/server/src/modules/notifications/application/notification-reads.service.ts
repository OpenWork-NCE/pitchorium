import { Inject, Injectable } from '@nestjs/common';
import {
  type Counters,
  type CursorPage,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationChannel,
  type NotificationListQuery,
  type NotificationPreferences,
  type ResubscribeRequest,
  type UnsubscribeResult,
  WEEKDAYS,
  type UpdateNotificationPreferencesRequest,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, decodeKeyset, DomainError, encodeKeyset } from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { WEEKLY_DIGEST_WEEKDAY } from '../domain/digest';
import { NOTIFICATION_DEFINITIONS, NOTIFICATION_FAMILY_TYPES } from '../domain/notification-types';
import { assertEditable, resolveChannels } from '../domain/preferences';
import { CountersService } from './counters.service';
import { EmailLinks } from './email-links';
import { NotificationPresenter } from './notification-presenter';
import { NotificationsRepository } from './ports';

/** What a member reads and decides about their notifications (§10.5). */
@Injectable()
export class NotificationReadsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly presenter: NotificationPresenter,
    private readonly counters: CountersService,
    private readonly links: EmailLinks,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly identity: IdentityFacade,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async list(userId: string, query: NotificationListQuery): Promise<CursorPage<Notification>> {
    const records = await this.notifications.notifications(
      userId,
      query.unread ?? false,
      query.family ? NOTIFICATION_FAMILY_TYPES[query.family] : null,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = records.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.presenter.present(userId, page),
      nextCursor:
        records.length > query.limit && last
          ? encodeKeyset({ at: last.updatedAt, key: last.id })
          : null,
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const found = await this.notifications.findNotification(notificationId);
    if (found?.recipientId !== userId || !found.inApp) {
      throw new DomainError('NOTIFICATIONS_NOT_FOUND', 'Notification not found');
    }
    await this.notifications.markRead(userId, [notificationId], this.clock.now());
    await this.counters.push([userId]);
  }

  async markAllRead(userId: string): Promise<{ read: number }> {
    const read = await this.notifications.markRead(userId, 'all', this.clock.now());
    await this.counters.push([userId]);
    return { read };
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    if (!(await this.notifications.deleteNotification(userId, notificationId))) {
      throw new DomainError('NOTIFICATIONS_NOT_FOUND', 'Notification not found');
    }
    await this.counters.push([userId]);
  }

  counts(userId: string): Promise<Counters> {
    return this.counters.of(userId);
  }

  async preferences(userId: string): Promise<NotificationPreferences> {
    const [stored, settings, users] = await Promise.all([
      this.notifications.preferencesOf([userId]),
      this.notifications.settings(userId),
      this.identity.findUsers([userId]),
    ]);
    return {
      emailDigest: settings?.emailDigest ?? 'off',
      digestSchedule: {
        hour: this.config.notifications.digestHour,
        weeklyDay: WEEKDAYS[WEEKLY_DIGEST_WEEKDAY - 1]!,
        timeZone: users.get(userId)?.timeZone ?? 'UTC',
      },
      types: NOTIFICATION_TYPES.map((type) => {
        const definition = NOTIFICATION_DEFINITIONS[type];
        const chosen = new Map<NotificationChannel, boolean>(
          stored.filter((p) => p.type === type).map((p) => [p.channel, p.enabled]),
        );
        const inApp = resolveChannels(type, chosen, 'off').inApp;
        const email = definition.transactional
          ? definition.defaults.email
          : (chosen.get('email') ?? definition.defaults.email);
        return {
          type,
          transactional: definition.transactional,
          channels: { in_app: inApp, email },
        };
      }),
    };
  }

  async updatePreferences(
    userId: string,
    request: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> {
    for (const change of request.changes) assertEditable(change.type);
    const now = this.clock.now();
    await this.transactions.run(async () => {
      if (request.emailDigest) await this.notifications.setDigest(userId, request.emailDigest, now);
      for (const change of request.changes) {
        await this.notifications.setPreference({ userId, ...change }, now);
      }
    });
    return this.preferences(userId);
  }

  /** One-click unsubscribe (RFC 8058): a signed token, no session. */
  async unsubscribe(token: string): Promise<UnsubscribeResult> {
    const verified = this.links.verify(token);
    if (!verified) {
      throw new DomainError('NOTIFICATIONS_UNSUBSCRIBE_INVALID', 'Invalid unsubscribe token');
    }
    const now = this.clock.now();
    if (verified.scope === 'digest') {
      const previous = (await this.notifications.settings(verified.userId))?.emailDigest ?? 'off';
      await this.notifications.setDigest(verified.userId, 'off', now);
      return { scope: 'digest', previousDigest: previous };
    }
    if (!NOTIFICATION_DEFINITIONS[verified.scope].transactional) {
      await this.notifications.setPreference(
        { userId: verified.userId, type: verified.scope, channel: 'email', enabled: false },
        now,
      );
    }
    return { scope: verified.scope, previousDigest: null };
  }

  /**
   * Undo of an unsubscribe from its page (§10.5), by the same signed token: the email of the
   * type is turned on again, or the digest restored to the given rhythm.
   */
  async resubscribe(token: string, request: ResubscribeRequest): Promise<UnsubscribeResult> {
    const verified = this.links.verify(token);
    if (!verified) {
      throw new DomainError('NOTIFICATIONS_UNSUBSCRIBE_INVALID', 'Invalid unsubscribe token');
    }
    const now = this.clock.now();
    if (verified.scope === 'digest') {
      if (request.emailDigest) {
        await this.notifications.setDigest(verified.userId, request.emailDigest, now);
      }
      return { scope: 'digest', previousDigest: null };
    }
    if (!NOTIFICATION_DEFINITIONS[verified.scope].transactional) {
      await this.notifications.setPreference(
        { userId: verified.userId, type: verified.scope, channel: 'email', enabled: true },
        now,
      );
    }
    return { scope: verified.scope, previousDigest: null };
  }
}
