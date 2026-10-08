import { z } from 'zod';
import { timeZoneSchema } from './identity.js';
import { uuidV7Schema } from './ids.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import {
  countryCodeSchema,
  httpsUrlSchema,
  languageCodeSchema,
  memberCardSchema,
  referenceCodeSchema,
} from './profiles.js';

/**
 * Events (§14, V3). The specification gives no functional content (docs/open-questions.md):
 * free events organised by a member or an organization, with registration, waiting list and
 * calendar export, to be validated with the client (ADR 0069, 0070).
 */
export const EVENT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,79}$/;
export const eventSlugSchema = z.string().regex(EVENT_SLUG_PATTERN);

/** Provisional limits (docs/open-questions.md). */
export const EVENT_TITLE_MAX_LENGTH = 120;
export const EVENT_DESCRIPTION_MAX_LENGTH = 10_000;
export const EVENT_LOCATION_MAX_LENGTH = 200;
export const EVENT_SECTORS_MAX = 5;
export const EVENT_COUNTRIES_MAX = 10;
export const EVENT_CAPACITY_MAX = 100_000;
/** An event lasts at most this many days. */
export const EVENT_MAX_DURATION_DAYS = 14;

/** Online, in person, or both. */
export const EVENT_FORMATS = ['online', 'in_person', 'hybrid'] as const;
export const eventFormatSchema = z.enum(EVENT_FORMATS);

export const EVENT_STATUSES = ['draft', 'published', 'canceled', 'completed'] as const;
export const eventStatusSchema = z.enum(EVENT_STATUSES);

/** Same rule as publications: `public` needs a public organizer (ADR 0031). */
export const EVENT_VISIBILITIES = ['public', 'members'] as const;
export const eventVisibilitySchema = z.enum(EVENT_VISIBILITIES);

export const EVENT_MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export const eventModerationStatusSchema = z.enum(EVENT_MODERATION_STATUSES);

/** `waitlisted` until a seat frees up, then promoted to `registered`. */
export const EVENT_REGISTRATION_STATUSES = ['registered', 'waitlisted'] as const;
export const eventRegistrationStatusSchema = z.enum(EVENT_REGISTRATION_STATUSES);

export const eventLocationSchema = z.object({
  name: z.string().trim().min(1).max(EVENT_LOCATION_MAX_LENGTH),
  address: z.string().trim().min(1).max(EVENT_LOCATION_MAX_LENGTH).nullable(),
  city: z.string().trim().min(1).max(100),
  countryCode: countryCodeSchema,
});

const eventFields = {
  title: z.string().trim().min(1).max(EVENT_TITLE_MAX_LENGTH),
  /** Restricted Markdown, as the description of a project. */
  description: z.string().trim().max(EVENT_DESCRIPTION_MAX_LENGTH),
  format: eventFormatSchema,
  /** Instants with an offset (2026-11-12T18:00:00+01:00); stored in UTC. */
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  /** Time zone in which the event takes place, for display and the calendar. */
  timeZone: timeZoneSchema,
  /** Required in person or hybrid. */
  location: eventLocationSchema.nullable(),
  /** Required online or hybrid; revealed to registered members only. */
  onlineUrl: httpsUrlSchema.nullable(),
  language: languageCodeSchema,
  sectorCodes: z.array(referenceCodeSchema).max(EVENT_SECTORS_MAX),
  countryCodes: z.array(countryCodeSchema).max(EVENT_COUNTRIES_MAX),
  /** Ready image of the organizer (media usage `event_image`). */
  imageMediaId: uuidV7Schema.nullable(),
  /** Seats; null for an unlimited event. */
  capacity: z.number().int().min(1).max(EVENT_CAPACITY_MAX).nullable(),
  visibility: eventVisibilitySchema,
};

export const createEventRequestSchema = z.object({
  ...eventFields,
  description: eventFields.description.default(''),
  location: eventFields.location.default(null),
  onlineUrl: eventFields.onlineUrl.default(null),
  sectorCodes: eventFields.sectorCodes.default([]),
  countryCodes: eventFields.countryCodes.default([]),
  imageMediaId: eventFields.imageMediaId.default(null),
  capacity: eventFields.capacity.default(null),
  visibility: eventFields.visibility.default('members'),
  /** Organized on behalf of an organization the member is `owner` or `admin` of. */
  organizationId: uuidV7Schema.nullable().default(null),
  /** Attached to a project of whose team the member is part. */
  projectId: uuidV7Schema.nullable().default(null),
});

export const updateEventRequestSchema = z.object(eventFields).partial();
export const changeEventSlugRequestSchema = z.object({ slug: eventSlugSchema });
export const cancelEventRequestSchema = z.object({
  reason: z.string().trim().max(500).nullable().default(null),
});

export const registerToEventRequestSchema = z.object({
  /** Explicit consent to appear in the attendee list shown to the other attendees. */
  showInAttendees: z.boolean().default(false),
});

export const eventOrganizerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('member'), member: memberCardSchema }),
  z.object({
    kind: z.literal('organization'),
    organization: z.object({
      id: uuidV7Schema,
      slug: z.string(),
      name: z.string(),
      logoUrl: z.string().nullable(),
      verified: z.boolean(),
    }),
  }),
]);

export const eventCardSchema = z.object({
  id: uuidV7Schema,
  slug: eventSlugSchema,
  title: z.string(),
  format: eventFormatSchema,
  status: eventStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  timeZone: z.string(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  language: z.string(),
  sectorCodes: z.array(z.string()),
  imageUrl: z.string().nullable(),
  organizer: eventOrganizerSchema,
  capacity: z.number().int().nullable(),
  registeredCount: z.number().int(),
  /** No seat left: a registration joins the waiting list. */
  full: z.boolean(),
});

export const eventViewerSchema = z.object({
  registration: eventRegistrationStatusSchema.nullable(),
  /** 1 for the next member promoted; null outside the waiting list. */
  waitlistPosition: z.number().int().nullable(),
  showInAttendees: z.boolean(),
  /** The organizer, the owners and admins of the organizing organization. */
  canManage: z.boolean(),
});

export const eventSchema = eventCardSchema.extend({
  description: z.string(),
  visibility: eventVisibilitySchema,
  location: eventLocationSchema.nullable(),
  /** Null unless the reader is registered or manages the event. */
  onlineUrl: z.string().nullable(),
  countryCodes: z.array(z.string()),
  imageMediaId: z.string().nullable(),
  waitlistCount: z.number().int(),
  project: z.object({ id: uuidV7Schema, slug: z.string(), title: z.string() }).nullable(),
  publishedAt: z.iso.datetime().nullable(),
  canceledAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  /** Null for an anonymous reader. */
  viewer: eventViewerSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const eventRegistrationSchema = z.object({
  eventId: uuidV7Schema,
  status: eventRegistrationStatusSchema,
  waitlistPosition: z.number().int().nullable(),
  showInAttendees: z.boolean(),
  registeredAt: z.iso.datetime(),
});

export const eventAttendeeSchema = z.object({
  member: memberCardSchema,
  /** Shown to the organizer only; the other attendees see registered members. */
  status: eventRegistrationStatusSchema,
  registeredAt: z.iso.datetime(),
});

export const eventListQuerySchema = cursorPageQuerySchema.extend({
  countryCode: countryCodeSchema.optional(),
  sectorCode: referenceCodeSchema.optional(),
  format: eventFormatSchema.optional(),
  language: languageCodeSchema.optional(),
  /** Events ending after this instant (default: now, upcoming and ongoing events). */
  from: z.iso.datetime({ offset: true }).optional(),
});

export const MY_EVENT_ROLES = ['organizer', 'attendee'] as const;
export const myEventRoleSchema = z.enum(MY_EVENT_ROLES);
export const myEventsQuerySchema = cursorPageQuerySchema.extend({
  role: myEventRoleSchema.default('attendee'),
});

export const eventIdParamsSchema = z.object({ eventId: uuidV7Schema });
export const eventSlugParamsSchema = z.object({ slug: eventSlugSchema });
export const calendarTokenParamsSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}\.ics$/),
});

export const calendarFeedSchema = z.object({
  /** Personal calendar URL (iCalendar), secret: it works without session until revoked. */
  url: z.string(),
  createdAt: z.iso.datetime(),
});

export const eventCardPageSchema = cursorPageSchema(eventCardSchema);
export const eventAttendeePageSchema = cursorPageSchema(eventAttendeeSchema);

export type EventFormat = z.infer<typeof eventFormatSchema>;
export type EventStatus = z.infer<typeof eventStatusSchema>;
export type EventVisibility = z.infer<typeof eventVisibilitySchema>;
export type EventModerationStatus = z.infer<typeof eventModerationStatusSchema>;
export type EventRegistrationStatus = z.infer<typeof eventRegistrationStatusSchema>;
export type EventLocation = z.infer<typeof eventLocationSchema>;
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;
export type EventOrganizer = z.infer<typeof eventOrganizerSchema>;
export type EventCard = z.infer<typeof eventCardSchema>;
export type EventView = z.infer<typeof eventSchema>;
export type EventViewer = z.infer<typeof eventViewerSchema>;
export type EventRegistration = z.infer<typeof eventRegistrationSchema>;
export type EventAttendee = z.infer<typeof eventAttendeeSchema>;
export type EventListQuery = z.infer<typeof eventListQuerySchema>;
export type MyEventRole = z.infer<typeof myEventRoleSchema>;
export type CalendarFeed = z.infer<typeof calendarFeedSchema>;
