import { Inject, Injectable, Logger } from '@nestjs/common';
import type { NotificationChannel } from '@pitchorium/contracts';
import {
  notificationText,
  renderNotificationDigestEmail,
  renderNotificationEmail,
  renderUnreadMessagesEmail,
} from '@pitchorium/emails';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { type MailMessage, Mailer } from '../../../platform/mailer';
import { OutboxService } from '../../../platform/outbox';
import { IdentityFacade } from '../../identity';
import { MessagingFacade } from '../../messaging';
import { ProfilesFacade } from '../../profiles';
import { isDigestDue } from '../domain/digest';
import { NOTIFICATION_DEFINITIONS, pathOf } from '../domain/notification-types';
import { EmailSent } from '../domain/notifications-events';
import { wantsUnreadCopy } from '../domain/preferences';
import { EmailLinks } from './email-links';
import { type NotificationRecord, NotificationsRepository } from './ports';

/** Notifications listed in one digest, the most recent first. */
const DIGEST_MAX_ITEMS = 30;
/** Messages quoted in the email of a conversation. */
const UNREAD_EXCERPTS = 5;
const EXCERPT_LENGTH = 280;
const BATCH = 200;

/**
 * Emails of the notifications (§10.5, §10.4): one at once, the daily or weekly digest in the
 * time zone of each member, the copy of unread messages after a delay. Non-transactional
 * emails carry the one-click unsubscribe (RFC 8058); suppressed addresses are left out by the
 * mailer. Each sent email records `notifications.email.sent.v1`.
 */
@Injectable()
export class NotificationEmailsService {
  private readonly logger = new Logger(NotificationEmailsService.name);

  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly identity: IdentityFacade,
    private readonly profiles: ProfilesFacade,
    private readonly messaging: MessagingFacade,
    private readonly mailer: Mailer,
    private readonly links: EmailLinks,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  /** The email of a notification created with the immediate email mode, sent once. */
  async immediate(notification: NotificationRecord): Promise<void> {
    if (notification.emailMode !== 'immediate' || notification.emailedAt) return;
    const user = await this.identity.findUser(notification.recipientId);
    if (!user) return;
    const transactional = NOTIFICATION_DEFINITIONS[notification.type].transactional;
    const token = transactional ? null : this.links.unsubscribeToken(user.id, notification.type);
    const email = await renderNotificationEmail({
      locale: user.locale,
      name: user.name,
      type: notification.type,
      grouped: notification.actorCount > 1 || notification.eventCount > 1,
      params: await this.params(notification, user.id),
      actionUrl: this.links.webUrl(pathOf(notification.targetType, notification.targetId)),
      unsubscribeUrl: token ? this.links.unsubscribePage(token) : null,
    });
    const delivered = await this.send({
      to: user.email,
      ...email,
      ...(token ? { headers: this.links.unsubscribeHeaders(token) } : {}),
    });
    await this.sent(user.id, 'notification', [notification.id], delivered);
  }

  /** Digests due now, in the time zone of each member (ADR 0061). */
  async digests(): Promise<number> {
    let sent = 0;
    let after: string | null = null;
    for (;;) {
      const recipients = await this.notifications.digestRecipients(after, BATCH);
      for (const userId of recipients) {
        if (await this.digestOf(userId)) sent += 1;
      }
      if (recipients.length < BATCH) return sent;
      after = recipients.at(-1) ?? null;
    }
  }

  private async digestOf(userId: string): Promise<boolean> {
    const [user, settings] = await Promise.all([
      this.identity.findUser(userId),
      this.notifications.settings(userId),
    ]);
    const now = this.clock.now();
    const digest = settings?.emailDigest ?? 'off';
    const pending = await this.notifications.digestPending(userId, DIGEST_MAX_ITEMS);
    if (!user || digest === 'off') {
      // The member left the digest: the waiting notifications stay in the app only.
      await this.notifications.markEmailed(
        pending.map((notification) => notification.id),
        now,
      );
      return false;
    }
    const due = isDigestDue({
      now,
      timeZone: user.timeZone,
      digest,
      lastDigestAt: settings?.lastDigestAt ?? null,
      hour: this.config.notifications.digestHour,
    });
    if (!due || pending.length === 0) return false;
    const token = this.links.unsubscribeToken(user.id, 'digest');
    const items = [];
    for (const notification of pending) {
      items.push({
        text: notificationText(
          user.locale,
          notification.type,
          notification.actorCount > 1 || notification.eventCount > 1,
          await this.params(notification, user.id),
        ),
        url: this.links.webUrl(pathOf(notification.targetType, notification.targetId)),
      });
    }
    const email = await renderNotificationDigestEmail({
      locale: user.locale,
      name: user.name,
      period: digest,
      items,
      notificationsUrl: this.links.webUrl('/notifications'),
      unsubscribeUrl: this.links.unsubscribePage(token),
    });
    const delivered = await this.send({
      to: user.email,
      ...email,
      headers: this.links.unsubscribeHeaders(token),
    });
    await this.transactions.run(async () => {
      await this.notifications.setLastDigestAt(user.id, now);
      await this.sent(
        user.id,
        'digest',
        pending.map((notification) => notification.id),
        delivered,
      );
    });
    return true;
  }

  /**
   * After a message, each recipient who turned the copy on waits for the delay; later
   * messages of the same conversation join the same email (§10.4).
   */
  async scheduleUnreadCopies(
    conversationId: string,
    sequence: number,
    recipientIds: readonly string[],
  ): Promise<void> {
    if (recipientIds.length === 0) return;
    const preferences = await this.notifications.preferencesOf(recipientIds, 'message');
    const now = this.clock.now();
    for (const recipientId of recipientIds) {
      const chosen = new Map<NotificationChannel, boolean>(
        preferences
          .filter((preference) => preference.userId === recipientId)
          .map((preference) => [preference.channel, preference.enabled]),
      );
      if (!wantsUnreadCopy(chosen)) continue;
      const state = await this.messaging.unreadState(recipientId, conversationId);
      if (!state || state.muted) continue;
      await this.notifications.scheduleUnreadEmail(
        {
          recipientId,
          conversationId,
          firstSequence: sequence,
          lastSequence: sequence,
          dueAt: new Date(now.getTime() + this.config.notifications.unreadMessageEmailDelayMs),
        },
        now,
      );
    }
  }

  /** Copies due now: sent if the messages are still unread, dropped otherwise. */
  async unreadCopies(): Promise<number> {
    let sent = 0;
    for (const row of await this.notifications.dueUnreadEmails(this.clock.now(), BATCH)) {
      try {
        if (await this.unreadCopy(row.recipientId, row.conversationId, row.lastSequence)) sent += 1;
      } finally {
        await this.notifications.deleteUnreadEmail(row.recipientId, row.conversationId);
      }
    }
    return sent;
  }

  private async unreadCopy(
    recipientId: string,
    conversationId: string,
    lastSequence: number,
  ): Promise<boolean> {
    const state = await this.messaging.unreadState(recipientId, conversationId);
    if (!state || state.muted || state.lastReadSequence >= lastSequence) return false;
    const [user, messages] = await Promise.all([
      this.identity.findUser(recipientId),
      this.messaging.unreadMessages(recipientId, conversationId, UNREAD_EXCERPTS),
    ]);
    if (!user || messages.length === 0) return false;
    const cards = await this.profiles.memberCards(
      [...new Set(messages.map((message) => message.senderId))],
      recipientId,
    );
    const nameOf = (id: string) => cards.get(id)?.displayName ?? '';
    const latest = messages.at(-1)!;
    const token = this.links.unsubscribeToken(user.id, 'message');
    const email = await renderUnreadMessagesEmail({
      locale: user.locale,
      name: user.name,
      sender: nameOf(latest.senderId),
      count: messages.length,
      excerpts: messages.map((message) => ({
        sender: nameOf(message.senderId),
        text: message.body.slice(0, EXCERPT_LENGTH),
        attachments: message.attachments,
      })),
      conversationUrl: this.links.webUrl(pathOf('conversation', conversationId)),
      unsubscribeUrl: this.links.unsubscribePage(token),
    });
    const delivered = await this.send({
      to: user.email,
      ...email,
      headers: this.links.unsubscribeHeaders(token),
    });
    await this.sent(user.id, 'unread_messages', [], delivered);
    return delivered;
  }

  /** Values of the notification texts: first actor, others, title of the project. */
  private async params(notification: NotificationRecord, viewerId: string) {
    const firstActor = notification.actorIds[0];
    const card = firstActor
      ? (await this.profiles.memberCards([firstActor], viewerId)).get(firstActor)
      : undefined;
    const title = notification.data['title'];
    const position = notification.data['position'];
    const count = notification.data['count'];
    return {
      actor: card?.displayName ?? '',
      others: Math.max(0, notification.actorCount - 1),
      count: typeof count === 'number' ? count : notification.eventCount,
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof position === 'number' ? { position } : {}),
    };
  }

  /** False when the address is suppressed (bounce or complaint): nothing left. */
  private async send(message: MailMessage): Promise<boolean> {
    const receipt = await this.mailer.send(message);
    return !(receipt.messageId === undefined && (receipt.suppressed?.length ?? 0) > 0);
  }

  /** Marks the notifications as emailed (never retried) and records the sent email. */
  private async sent(
    recipientId: string,
    kind: string,
    notificationIds: string[],
    delivered: boolean,
  ): Promise<void> {
    const now = this.clock.now();
    await this.transactions.run(async () => {
      if (notificationIds.length > 0) await this.notifications.markEmailed(notificationIds, now);
      if (!delivered) return;
      await this.outbox.record(
        new EmailSent({
          id: this.ids.next(),
          aggregateId: recipientId,
          occurredAt: now,
          payload: { recipientId, kind, items: Math.max(1, notificationIds.length) },
        }),
      );
    });
    this.logger.debug(`Email ${kind} sent to ${recipientId}`);
  }
}
