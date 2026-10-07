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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const platformSchema = pgSchema('platform');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const outboxEvents = platformSchema.table(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamptz('occurred_at').notNull(),
    publishedAt: timestamptz('published_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    // Drives the relay exponential backoff; equals occurred_at until a publication fails.
    nextAttemptAt: timestamptz('next_attempt_at').notNull(),
  },
  (table) => [
    index('outbox_events_pending_idx')
      .on(table.nextAttemptAt, table.occurredAt)
      .where(sql`${table.publishedAt} is null`),
    index('outbox_events_aggregate_idx').on(table.aggregateType, table.aggregateId),
  ],
);

export const inboxMessages = platformSchema.table(
  'inbox_messages',
  {
    id: uuid('id').primaryKey(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    receivedAt: timestamptz('received_at').notNull(),
    processedAt: timestamptz('processed_at'),
  },
  (table) => [
    uniqueIndex('inbox_messages_source_external_id_uq').on(table.source, table.externalId),
  ],
);

export const idempotencyKeys = platformSchema.table(
  'idempotency_keys',
  {
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamptz('created_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'idempotency_keys_pk', columns: [table.scope, table.key] }),
    index('idempotency_keys_expires_at_idx').on(table.expiresAt),
  ],
);

export const auditLog = platformSchema.table(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    requestId: text('request_id'),
    occurredAt: timestamptz('occurred_at').notNull(),
  },
  (table) => [
    index('audit_log_target_idx').on(table.targetType, table.targetId, table.occurredAt),
    index('audit_log_actor_idx').on(table.actorType, table.actorId, table.occurredAt),
    index('audit_log_occurred_at_idx').on(table.occurredAt),
  ],
);

export const featureFlags = platformSchema.table('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull(),
  description: text('description').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});
