import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const privacySchema = pgSchema('privacy');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Exports of personal data (GDPR articles 15 and 20): an archive in the private bucket, read
 * by a short-lived link until it expires.
 */
export const privacyExports = privacySchema.table(
  'exports',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id'),
    status: text('status').notNull(),
    storageKey: text('storage_key'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    error: text('error'),
    requestedAt: timestamptz('requested_at').notNull(),
    completedAt: timestamptz('completed_at'),
    expiresAt: timestamptz('expires_at'),
  },
  (table) => [
    index('exports_user_id_idx').on(table.userId, table.requestedAt),
    index('exports_expires_at_idx')
      .on(table.expiresAt)
      .where(sql`${table.status} = 'ready'`),
  ],
);

/**
 * Erasure of an account (GDPR article 17) after a grace period. While it runs, the request
 * holds the random pseudonym of the member (same in every module, never derived from the id)
 * and the contact of the confirmation email; both are cleared once it completes.
 */
export const privacyErasures = privacySchema.table(
  'erasures',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id'),
    status: text('status').notNull(),
    pseudonym: uuid('pseudonym'),
    contact: jsonb('contact').$type<{ email: string; name: string | null; locale: string }>(),
    /** Modules already erased, for a resumed execution. */
    progress: text('progress').array().notNull(),
    blockedBy: text('blocked_by'),
    /** Columns where a residue was found by the final check. */
    residues: text('residues').array(),
    requestedAt: timestamptz('requested_at').notNull(),
    scheduledFor: timestamptz('scheduled_for').notNull(),
    remindedAt: timestamptz('reminded_at'),
    canceledAt: timestamptz('canceled_at'),
    startedAt: timestamptz('started_at'),
    completedAt: timestamptz('completed_at'),
  },
  (table) => [
    uniqueIndex('erasures_open_user_uq')
      .on(table.userId)
      .where(sql`${table.status} in ('scheduled', 'running', 'blocked')`),
    index('erasures_due_idx')
      .on(table.scheduledFor)
      .where(sql`${table.status} in ('scheduled', 'running')`),
    index('erasures_requested_at_idx').on(table.requestedAt),
  ],
);
