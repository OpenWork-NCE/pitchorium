import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const eventsSchema = pgSchema('events');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Free events (§14, scope to validate, ADR 0069 and 0070). Members, organizations, projects
 * and media are identifiers of other modules (no cross-module FK). Instants are UTC; the time
 * zone of the place is kept for display and calendars.
 */
export const eventsEvents = eventsSchema.table(
  'events',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull(),
    /** Member who created the event, organizer in the name of the organization if any. */
    organizerId: uuid('organizer_id').notNull(),
    organizationId: uuid('organization_id'),
    projectId: uuid('project_id'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    format: text('format').notNull(),
    status: text('status').notNull(),
    visibility: text('visibility').notNull(),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    timeZone: text('time_zone').notNull(),
    locationName: text('location_name'),
    locationAddress: text('location_address'),
    locationCity: text('location_city'),
    locationCountryCode: text('location_country_code'),
    /** Revealed to registered members and organizers only. */
    onlineUrl: text('online_url'),
    language: text('language').notNull(),
    sectorCodes: text('sector_codes').array().notNull(),
    countryCodes: text('country_codes').array().notNull(),
    imageMediaId: uuid('image_media_id'),
    /** Null: unlimited. */
    capacity: integer('capacity'),
    registeredCount: integer('registered_count').notNull(),
    waitlistCount: integer('waitlist_count').notNull(),
    /** iCalendar SEQUENCE, incremented by every change seen by the attendees. */
    sequence: integer('sequence').notNull(),
    moderationStatus: text('moderation_status').notNull(),
    cancelReason: text('cancel_reason'),
    publishedAt: timestamptz('published_at'),
    canceledAt: timestamptz('canceled_at'),
    completedAt: timestamptz('completed_at'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    uniqueIndex('events_slug_uq').on(table.slug),
    index('events_organizer_id_idx').on(table.organizerId, table.createdAt),
    index('events_organization_id_idx')
      .on(table.organizationId)
      .where(sql`${table.organizationId} is not null`),
    index('events_listing_idx')
      .on(table.endsAt, table.id)
      .where(
        sql`${table.status} = 'published' and ${table.deletedAt} is null and ${table.moderationStatus} = 'visible'`,
      ),
    index('events_feed_idx')
      .on(table.organizerId, table.publishedAt, table.id)
      .where(sql`${table.status} = 'published' and ${table.deletedAt} is null`),
  ],
);

/** Former slugs, kept for redirects and never given to another event. */
export const eventsSlugHistory = eventsSchema.table(
  'slug_history',
  {
    slug: text('slug').primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => eventsEvents.id, { onDelete: 'cascade' }),
    replacedAt: timestamptz('replaced_at').notNull(),
  },
  (table) => [index('events_slug_history_event_id_idx').on(table.eventId)],
);

/**
 * Registrations: `registered` within the capacity, `waitlisted` beyond, promoted in order of
 * registration when a seat frees up. A withdrawal deletes the row.
 */
export const eventsRegistrations = eventsSchema.table(
  'registrations',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => eventsEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    status: text('status').notNull(),
    /** Explicit consent to appear in the list shown to the other attendees. */
    showInAttendees: boolean('show_in_attendees').notNull(),
    registeredAt: timestamptz('registered_at').notNull(),
    promotedAt: timestamptz('promoted_at'),
  },
  (table) => [
    primaryKey({ name: 'registrations_pk', columns: [table.eventId, table.userId] }),
    index('registrations_queue_idx').on(
      table.eventId,
      table.status,
      table.registeredAt,
      table.userId,
    ),
    index('registrations_user_id_idx').on(table.userId, table.status),
  ],
);

/** Secret of the personal calendar feed of a member: only its SHA-256 is stored. */
export const eventsCalendarTokens = eventsSchema.table(
  'calendar_tokens',
  {
    userId: uuid('user_id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [uniqueIndex('calendar_tokens_token_hash_uq').on(table.tokenHash)],
);
