import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const networkSchema = pgSchema('network');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Unilateral follows (§10.2) of a generic target: `member`, `organization`, and the types other
 * modules register (`project`). Identifiers belong to other modules (no FK).
 */
export const networkFollows = networkSchema.table(
  'follows',
  {
    followerId: uuid('follower_id').notNull(),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** `manual`, or `connection` when created by an accepted connection. */
    origin: text('origin').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'follows_pk',
      columns: [table.followerId, table.targetType, table.targetId],
    }),
    // Followers of a target (lists and counts). Ascending columns: lists read them backwards,
    // newest first, with the last columns as keyset tie-breakers.
    index('follows_target_idx').on(
      table.targetType,
      table.targetId,
      table.createdAt,
      table.followerId,
    ),
    // Targets followed by a member (lists and feed).
    index('follows_follower_created_idx').on(table.followerId, table.createdAt, table.targetId),
  ],
);

/** Accepted connections, one row per direction so that every lookup starts from user_id. */
export const networkConnections = networkSchema.table(
  'connections',
  {
    userId: uuid('user_id').notNull(),
    peerId: uuid('peer_id').notNull(),
    connectedAt: timestamptz('connected_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'connections_pk', columns: [table.userId, table.peerId] }),
    index('connections_user_connected_idx').on(table.userId, table.connectedAt, table.peerId),
  ],
);

export const networkConnectionRequests = networkSchema.table(
  'connection_requests',
  {
    id: uuid('id').primaryKey(),
    requesterId: uuid('requester_id').notNull(),
    addresseeId: uuid('addressee_id').notNull(),
    note: text('note'),
    status: text('status').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    respondedAt: timestamptz('responded_at'),
  },
  (table) => [
    // At most one pending request between two members, whatever its direction.
    uniqueIndex('connection_requests_pending_pair_uq')
      .on(
        sql`least(${table.requesterId}, ${table.addresseeId})`,
        sql`greatest(${table.requesterId}, ${table.addresseeId})`,
      )
      .where(sql`${table.status} = 'pending'`),
    index('connection_requests_addressee_idx').on(
      table.addresseeId,
      table.status,
      table.createdAt,
      table.id,
    ),
    // Sent requests, weekly limit and decline cooldown.
    index('connection_requests_requester_idx').on(table.requesterId, table.createdAt, table.id),
    index('connection_requests_pending_expiry_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const networkBlocks = networkSchema.table(
  'blocks',
  {
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'blocks_pk', columns: [table.blockerId, table.blockedId] }),
    index('blocks_blocked_idx').on(table.blockedId),
    index('blocks_blocker_created_idx').on(table.blockerId, table.createdAt),
  ],
);

/** Network preferences of a member; absent row means the defaults. */
export const networkSettings = networkSchema.table('settings', {
  userId: uuid('user_id').primaryKey(),
  privateProfileViews: boolean('private_profile_views').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});

/**
 * Profile views, one per visitor, visited member and day (UTC). Written in batches by the
 * worker from a Redis buffer (ADR 0030); `private` is the visitor's preference at that time.
 */
export const networkProfileViews = networkSchema.table(
  'profile_views',
  {
    viewedId: uuid('viewed_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    viewerId: uuid('viewer_id').notNull(),
    viewedAt: timestamptz('viewed_at').notNull(),
    private: boolean('private').notNull(),
  },
  (table) => [
    primaryKey({ name: 'profile_views_pk', columns: [table.viewedId, table.day, table.viewerId] }),
    index('profile_views_day_idx').on(table.day),
  ],
);
