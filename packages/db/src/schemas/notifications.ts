import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const notificationsSchema = pgSchema('notifications');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Notifications of a member (§10.5, ADR 0059). One row per recipient and grouping key while its
 * window is open: later events add their actor (`actor_ids`, the most recent first) and
 * increment `actor_count` instead of creating rows.
 */
export const notificationsNotifications = notificationsSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    recipientId: uuid('recipient_id').notNull(),
    type: text('type').notNull(),
    groupKey: text('group_key').notNull(),
    priority: text('priority').notNull(),
    /** Most recent actors first, a few only; `actor_count` counts them all. */
    actorIds: uuid('actor_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    actorCount: integer('actor_count').notNull(),
    eventCount: integer('event_count').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    /** Identifiers and codes of the source event the clients display (never texts). */
    data: jsonb('data').$type<Record<string, string | number | boolean | null>>().notNull(),
    windowEndsAt: timestamptz('window_ends_at').notNull(),
    readAt: timestamptz('read_at'),
    /** Shown in the app (in-app channel of the type for the member). */
    inApp: boolean('in_app').notNull().default(true),
    /** Email channel when created: `off`, `immediate` or `digest` (ADR 0060). */
    emailMode: text('email_mode').notNull().default('off'),
    /** Sent by email (immediately or in a digest); null when not yet or never. */
    emailedAt: timestamptz('emailed_at'),
    /** Waits for a digest: email channel on, digest chosen. */
    digestPending: boolean('digest_pending').notNull().default(false),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('notifications_recipient_idx')
      .on(table.recipientId, table.updatedAt, table.id)
      .where(sql`${table.inApp}`),
    index('notifications_open_group_idx')
      .on(table.recipientId, table.groupKey, table.windowEndsAt)
      .where(sql`${table.readAt} is null`),
    index('notifications_unread_idx')
      .on(table.recipientId)
      .where(sql`${table.readAt} is null and ${table.inApp}`),
    index('notifications_low_priority_idx')
      .on(table.recipientId, table.createdAt)
      .where(sql`${table.priority} = 'low'`),
    index('notifications_digest_idx')
      .on(table.recipientId, table.createdAt)
      .where(sql`${table.digestPending}`),
    index('notifications_created_idx').on(table.createdAt),
  ],
);

/**
 * Idempotency of the creation (ADR 0059): one row per source event and recipient. The source
 * is an outbox event id, or a stable key for scheduled sources (`profile-views:<day>`).
 */
export const notificationsDeliveries = notificationsSchema.table(
  'deliveries',
  {
    source: text('source').notNull(),
    recipientId: uuid('recipient_id').notNull(),
    notificationId: uuid('notification_id'),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'deliveries_pk', columns: [table.source, table.recipientId] }),
    index('deliveries_created_idx').on(table.createdAt),
  ],
);

/** Preferences per type and channel (ADR 0060); a missing row means the type default. */
export const notificationsPreferences = notificationsSchema.table(
  'preferences',
  {
    userId: uuid('user_id').notNull(),
    type: text('type').notNull(),
    channel: text('channel').notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'preferences_pk', columns: [table.userId, table.type, table.channel] }),
  ],
);

/** Email digest of a member (ADR 0061): `off`, `daily` or `weekly`, and the last one sent. */
export const notificationsSettings = notificationsSchema.table(
  'settings',
  {
    userId: uuid('user_id').primaryKey(),
    emailDigest: text('email_digest').notNull(),
    lastDigestAt: timestamptz('last_digest_at'),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [index('settings_digest_idx').on(table.emailDigest)],
);

/**
 * Addresses the mailer never writes to again (ADR 0062): hard bounce or complaint reported by
 * the email provider. Stored lower-cased.
 */
export const notificationsSuppressions = notificationsSchema.table('suppressions', {
  email: text('email').primaryKey(),
  reason: text('reason').notNull(),
  providerEventId: text('provider_event_id'),
  createdAt: timestamptz('created_at').notNull(),
});

/**
 * Unread message emails (§10.4) waiting for their delay, one per recipient and conversation:
 * later messages of the same conversation join the pending email.
 */
export const notificationsUnreadMessageEmails = notificationsSchema.table(
  'unread_message_emails',
  {
    recipientId: uuid('recipient_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    firstSequence: integer('first_sequence').notNull(),
    lastSequence: integer('last_sequence').notNull(),
    dueAt: timestamptz('due_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'unread_message_emails_pk',
      columns: [table.recipientId, table.conversationId],
    }),
    index('unread_message_emails_due_idx').on(table.dueAt),
  ],
);
