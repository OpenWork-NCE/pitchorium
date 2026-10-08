import type {
  EmailDigest,
  NotificationChannel,
  NotificationPriority,
  NotificationTargetType,
  NotificationType,
} from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { EmailMode } from '../domain/preferences';

export type NotificationData = Record<string, string | number | boolean | null>;

export interface NotificationRecord {
  id: string;
  recipientId: string;
  type: NotificationType;
  groupKey: string;
  priority: NotificationPriority;
  actorIds: string[];
  actorCount: number;
  eventCount: number;
  targetType: NotificationTargetType;
  targetId: string;
  data: NotificationData;
  windowEndsAt: Date;
  readAt: Date | null;
  inApp: boolean;
  emailMode: EmailMode;
  emailedAt: Date | null;
  digestPending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PreferenceRecord {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface UnreadMessageEmailRecord {
  recipientId: string;
  conversationId: string;
  firstSequence: number;
  lastSequence: number;
  dueAt: Date;
}

export abstract class NotificationsRepository {
  /** Transaction-scoped advisory lock on a key. */
  abstract lock(key: string): Promise<void>;
  /** Records the deliveries of a source; returns the recipients not delivered before. */
  abstract insertDeliveries(
    source: string,
    recipientIds: readonly string[],
    at: Date,
  ): Promise<string[]>;
  /** Open notifications of a group (window not ended, unread), by recipient. */
  abstract openNotifications(
    recipientIds: readonly string[],
    groupKey: string,
    at: Date,
  ): Promise<Map<string, NotificationRecord>>;
  /** Adds the event of one actor to the notifications: most recent actor first, counted once. */
  abstract aggregate(
    ids: readonly string[],
    actorId: string | null,
    maxActors: number,
    at: Date,
  ): Promise<void>;
  abstract insertNotifications(records: readonly NotificationRecord[]): Promise<void>;
  /** Low-priority notifications created for each recipient since a date (cap per member). */
  abstract countLowPrioritySince(
    recipientIds: readonly string[],
    since: Date,
  ): Promise<Map<string, number>>;
  abstract findNotification(id: string): Promise<NotificationRecord | null>;
  /** Notifications of the given ids that still exist (a batch to deliver). */
  abstract findNotifications(ids: readonly string[]): Promise<NotificationRecord[]>;
  abstract notifications(
    recipientId: string,
    unreadOnly: boolean,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<NotificationRecord[]>;
  abstract countUnread(recipientId: string): Promise<number>;
  abstract markRead(recipientId: string, ids: readonly string[] | 'all', at: Date): Promise<number>;
  abstract deleteNotification(recipientId: string, id: string): Promise<boolean>;
  abstract markEmailed(ids: readonly string[], at: Date): Promise<void>;
  abstract digestPending(recipientId: string, limit: number): Promise<NotificationRecord[]>;
  /** Members with notifications waiting for a digest, by ascending id. */
  abstract digestRecipients(afterUserId: string | null, limit: number): Promise<string[]>;
  abstract purgeBefore(at: Date): Promise<number>;

  abstract preferencesOf(
    userIds: readonly string[],
    type?: NotificationType,
  ): Promise<PreferenceRecord[]>;
  abstract setPreference(preference: PreferenceRecord, at: Date): Promise<void>;
  abstract digestsOf(userIds: readonly string[]): Promise<Map<string, EmailDigest>>;
  abstract settings(
    userId: string,
  ): Promise<{ emailDigest: EmailDigest; lastDigestAt: Date | null } | null>;
  abstract setDigest(userId: string, digest: EmailDigest, at: Date): Promise<void>;
  abstract setLastDigestAt(userId: string, at: Date): Promise<void>;

  abstract suppressed(emails: readonly string[]): Promise<Set<string>>;
  abstract suppress(
    email: string,
    reason: string,
    providerEventId: string,
    at: Date,
  ): Promise<boolean>;

  abstract scheduleUnreadEmail(row: UnreadMessageEmailRecord, at: Date): Promise<void>;
  abstract dueUnreadEmails(at: Date, limit: number): Promise<UnreadMessageEmailRecord[]>;
  abstract deleteUnreadEmail(recipientId: string, conversationId: string): Promise<void>;
}
