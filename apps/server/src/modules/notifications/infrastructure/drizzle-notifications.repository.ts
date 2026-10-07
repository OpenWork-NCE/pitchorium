import { Injectable } from '@nestjs/common';
import type {
  EmailDigest,
  NotificationChannel,
  NotificationPriority,
  NotificationTargetType,
  NotificationType,
} from '@pitchorium/contracts';
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, sql } from '@pitchorium/db/orm';
import {
  notificationsDeliveries,
  notificationsNotifications,
  notificationsPreferences,
  notificationsSettings,
  notificationsSuppressions,
  notificationsUnreadMessageEmails,
} from '@pitchorium/db/schemas/notifications';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import {
  type NotificationRecord,
  NotificationsRepository,
  type PreferenceRecord,
  type UnreadMessageEmailRecord,
} from '../application/ports';
import type { EmailMode } from '../domain/preferences';

const notifications = notificationsNotifications;
const deliveries = notificationsDeliveries;
const preferences = notificationsPreferences;
const settings = notificationsSettings;
const unreadEmails = notificationsUnreadMessageEmails;

/** Rows written per statement, below the bind parameter limit of PostgreSQL. */
const CHUNK = 500;

const toNotification = (row: typeof notifications.$inferSelect): NotificationRecord => ({
  ...row,
  type: row.type as NotificationType,
  priority: row.priority as NotificationPriority,
  targetType: row.targetType as NotificationTargetType,
  emailMode: row.emailMode as EmailMode,
});

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += CHUNK) {
    result.push(items.slice(index, index + CHUNK));
  }
  return result;
}

@Injectable()
export class DrizzleNotificationsRepository extends NotificationsRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertDeliveries(
    source: string,
    recipientIds: readonly string[],
    at: Date,
  ): Promise<string[]> {
    const fresh: string[] = [];
    for (const part of chunks(recipientIds)) {
      const rows = await this.db
        .insert(deliveries)
        .values(part.map((recipientId) => ({ source, recipientId, createdAt: at })))
        .onConflictDoNothing()
        .returning({ recipientId: deliveries.recipientId });
      fresh.push(...rows.map((row) => row.recipientId));
    }
    return fresh;
  }

  async openNotifications(
    recipientIds: readonly string[],
    groupKey: string,
    at: Date,
  ): Promise<Map<string, NotificationRecord>> {
    const open = new Map<string, NotificationRecord>();
    for (const part of chunks(recipientIds)) {
      const rows = await this.db
        .select()
        .from(notifications)
        .where(
          and(
            inArray(notifications.recipientId, part),
            eq(notifications.groupKey, groupKey),
            gt(notifications.windowEndsAt, at),
            isNull(notifications.readAt),
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .for('update');
      for (const row of rows) {
        if (!open.has(row.recipientId)) open.set(row.recipientId, toNotification(row));
      }
    }
    return open;
  }

  async aggregate(
    ids: readonly string[],
    actorId: string | null,
    maxActors: number,
    at: Date,
  ): Promise<void> {
    for (const part of chunks(ids)) {
      await this.db
        .update(notifications)
        .set({
          ...(actorId
            ? {
                actorIds: sql`(array_prepend(${actorId}::uuid, array_remove(${notifications.actorIds}, ${actorId}::uuid)))[1:${sql.raw(String(maxActors))}]`,
                actorCount: sql`${notifications.actorCount} + (case when ${actorId}::uuid = any(${notifications.actorIds}) then 0 else 1 end)`,
              }
            : {}),
          eventCount: sql`${notifications.eventCount} + 1`,
          updatedAt: at,
        })
        .where(inArray(notifications.id, part));
    }
  }

  async insertNotifications(records: readonly NotificationRecord[]): Promise<void> {
    for (const part of chunks(records)) await this.db.insert(notifications).values(part);
  }

  async countLowPrioritySince(
    recipientIds: readonly string[],
    since: Date,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const part of chunks(recipientIds)) {
      const rows = await this.db
        .select({ recipientId: notifications.recipientId, value: count() })
        .from(notifications)
        .where(
          and(
            inArray(notifications.recipientId, part),
            eq(notifications.priority, 'low'),
            gt(notifications.createdAt, since),
          ),
        )
        .groupBy(notifications.recipientId);
      for (const row of rows) counts.set(row.recipientId, row.value);
    }
    return counts;
  }

  async findNotification(id: string): Promise<NotificationRecord | null> {
    const [row] = await this.db.select().from(notifications).where(eq(notifications.id, id));
    return row ? toNotification(row) : null;
  }

  async notifications(
    recipientId: string,
    unreadOnly: boolean,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<NotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.inApp, true),
          unreadOnly ? isNull(notifications.readAt) : undefined,
          after
            ? sql`(${notifications.updatedAt}, ${notifications.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(notifications.updatedAt), desc(notifications.id))
      .limit(limit);
    return rows.map(toNotification);
  }

  async countUnread(recipientId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          eq(notifications.inApp, true),
          isNull(notifications.readAt),
        ),
      );
    return row?.value ?? 0;
  }

  async markRead(recipientId: string, ids: readonly string[] | 'all', at: Date): Promise<number> {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: at })
      .where(
        and(
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
          ids === 'all' ? undefined : inArray(notifications.id, [...ids]),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  async deleteNotification(recipientId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.recipientId, recipientId),
          eq(notifications.inApp, true),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markEmailed(ids: readonly string[], at: Date): Promise<void> {
    for (const part of chunks(ids)) {
      await this.db
        .update(notifications)
        .set({ emailedAt: at, digestPending: false })
        .where(inArray(notifications.id, part));
    }
  }

  async digestPending(recipientId: string, limit: number): Promise<NotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientId, recipientId), eq(notifications.digestPending, true)))
      .orderBy(desc(notifications.updatedAt))
      .limit(limit);
    return rows.map(toNotification);
  }

  async digestRecipients(afterUserId: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ recipientId: notifications.recipientId })
      .from(notifications)
      .where(
        and(
          eq(notifications.digestPending, true),
          afterUserId ? gt(notifications.recipientId, afterUserId) : undefined,
        ),
      )
      .orderBy(asc(notifications.recipientId))
      .limit(limit);
    return rows.map((row) => row.recipientId);
  }

  async purgeBefore(at: Date): Promise<number> {
    const removed = await this.db
      .delete(notifications)
      .where(sql`${notifications.updatedAt} < ${at}`)
      .returning({ id: notifications.id });
    await this.db.delete(deliveries).where(sql`${deliveries.createdAt} < ${at}`);
    await this.db.delete(unreadEmails).where(sql`${unreadEmails.createdAt} < ${at}`);
    return removed.length;
  }

  async preferencesOf(
    userIds: readonly string[],
    type?: NotificationType,
  ): Promise<PreferenceRecord[]> {
    const found: PreferenceRecord[] = [];
    for (const part of chunks(userIds)) {
      const rows = await this.db
        .select()
        .from(preferences)
        .where(
          and(inArray(preferences.userId, part), type ? eq(preferences.type, type) : undefined),
        );
      found.push(
        ...rows.map((row) => ({
          userId: row.userId,
          type: row.type as NotificationType,
          channel: row.channel as NotificationChannel,
          enabled: row.enabled,
        })),
      );
    }
    return found;
  }

  async setPreference(preference: PreferenceRecord, at: Date): Promise<void> {
    await this.db
      .insert(preferences)
      .values({ ...preference, updatedAt: at })
      .onConflictDoUpdate({
        target: [preferences.userId, preferences.type, preferences.channel],
        set: { enabled: preference.enabled, updatedAt: at },
      });
  }

  async digestsOf(userIds: readonly string[]): Promise<Map<string, EmailDigest>> {
    const digests = new Map<string, EmailDigest>();
    for (const part of chunks(userIds)) {
      const rows = await this.db
        .select({ userId: settings.userId, digest: settings.emailDigest })
        .from(settings)
        .where(inArray(settings.userId, part));
      for (const row of rows) digests.set(row.userId, row.digest as EmailDigest);
    }
    return digests;
  }

  async settings(
    userId: string,
  ): Promise<{ emailDigest: EmailDigest; lastDigestAt: Date | null } | null> {
    const [row] = await this.db.select().from(settings).where(eq(settings.userId, userId));
    return row
      ? { emailDigest: row.emailDigest as EmailDigest, lastDigestAt: row.lastDigestAt }
      : null;
  }

  async setDigest(userId: string, digest: EmailDigest, at: Date): Promise<void> {
    await this.db
      .insert(settings)
      .values({ userId, emailDigest: digest, updatedAt: at })
      .onConflictDoUpdate({ target: settings.userId, set: { emailDigest: digest, updatedAt: at } });
  }

  async setLastDigestAt(userId: string, at: Date): Promise<void> {
    await this.db
      .update(settings)
      .set({ lastDigestAt: at, updatedAt: at })
      .where(eq(settings.userId, userId));
  }

  async suppressed(emails: readonly string[]): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const rows = await this.db
      .select({ email: notificationsSuppressions.email })
      .from(notificationsSuppressions)
      .where(inArray(notificationsSuppressions.email, [...emails]));
    return new Set(rows.map((row) => row.email));
  }

  async suppress(
    email: string,
    reason: string,
    providerEventId: string,
    at: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .insert(notificationsSuppressions)
      .values({ email, reason, providerEventId, createdAt: at })
      .onConflictDoNothing()
      .returning({ email: notificationsSuppressions.email });
    return rows.length > 0;
  }

  async scheduleUnreadEmail(row: UnreadMessageEmailRecord, at: Date): Promise<void> {
    await this.db
      .insert(unreadEmails)
      .values({ ...row, createdAt: at })
      .onConflictDoUpdate({
        target: [unreadEmails.recipientId, unreadEmails.conversationId],
        set: { lastSequence: sql`greatest(${unreadEmails.lastSequence}, ${row.lastSequence})` },
      });
  }

  async dueUnreadEmails(at: Date, limit: number): Promise<UnreadMessageEmailRecord[]> {
    return this.db
      .select({
        recipientId: unreadEmails.recipientId,
        conversationId: unreadEmails.conversationId,
        firstSequence: unreadEmails.firstSequence,
        lastSequence: unreadEmails.lastSequence,
        dueAt: unreadEmails.dueAt,
      })
      .from(unreadEmails)
      .where(lte(unreadEmails.dueAt, at))
      .orderBy(asc(unreadEmails.dueAt))
      .limit(limit);
  }

  async deleteUnreadEmail(recipientId: string, conversationId: string): Promise<void> {
    await this.db
      .delete(unreadEmails)
      .where(
        and(
          eq(unreadEmails.recipientId, recipientId),
          eq(unreadEmails.conversationId, conversationId),
        ),
      );
  }
}
