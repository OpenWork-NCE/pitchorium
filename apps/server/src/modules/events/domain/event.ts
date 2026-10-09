import {
  EVENT_MAX_DURATION_DAYS,
  EVENT_SLUG_PATTERN,
  type EventFormat,
  type EventModerationStatus,
  type EventStatus,
  type EventVisibility,
} from '@pitchorium/contracts';
import { DomainError, restrictedMarkdownViolation, slugify } from '../../../platform/kernel';

export interface EventLocationRecord {
  name: string;
  address: string | null;
  city: string;
  countryCode: string;
}

export interface EventRecord {
  id: string;
  slug: string;
  organizerId: string;
  organizationId: string | null;
  projectId: string | null;
  title: string;
  description: string;
  format: EventFormat;
  status: EventStatus;
  visibility: EventVisibility;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  location: EventLocationRecord | null;
  onlineUrl: string | null;
  language: string;
  sectorCodes: string[];
  countryCodes: string[];
  imageMediaId: string | null;
  capacity: number | null;
  registeredCount: number;
  waitlistCount: number;
  sequence: number;
  moderationStatus: EventModerationStatus;
  cancelReason: string | null;
  publishedAt: Date | null;
  canceledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const DAY_MS = 86_400_000;

/**
 * Lifecycle (ADR 0069): a draft is published, then either canceled by its organizer or
 * completed by the scheduled task once it has ended. Canceled and completed are final.
 */
const TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  draft: ['published'],
  published: ['canceled', 'completed'],
  canceled: [],
  completed: [],
};

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('EVENTS_INVALID_TRANSITION', `An event cannot go from ${from} to ${to}`);
  }
}

/** A draft or a published event can still be edited; canceled and completed ones cannot. */
export function assertEditable(event: EventRecord): void {
  if (event.status !== 'draft' && event.status !== 'published') {
    throw new DomainError('EVENTS_INVALID_TRANSITION', `A ${event.status} event cannot change`);
  }
}

export function assertDraft(event: EventRecord): void {
  if (event.status !== 'draft') {
    throw new DomainError('EVENTS_NOT_DRAFT', 'Only a draft event allows this action');
  }
}

/**
 * The end follows the start, the event lasts EVENT_MAX_DURATION_DAYS at most, and a published
 * event is not over yet; each refusal names its reason (`ends_before_start`, `too_long`,
 * `already_over`), sent to the client in the problem (`reason`).
 */
export function assertSchedule(startsAt: Date, endsAt: Date, now: Date | null): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new DomainError('EVENTS_SCHEDULE_INVALID', 'The end must follow the start', {
      reason: 'ends_before_start',
    });
  }
  if (endsAt.getTime() - startsAt.getTime() > EVENT_MAX_DURATION_DAYS * DAY_MS) {
    throw new DomainError('EVENTS_SCHEDULE_INVALID', 'The event is too long', {
      reason: 'too_long',
    });
  }
  if (now && endsAt.getTime() <= now.getTime()) {
    throw new DomainError('EVENTS_SCHEDULE_INVALID', 'The event is already over', {
      reason: 'already_over',
    });
  }
}

/** A place in person or hybrid, a connection link online or hybrid. */
export function assertFormatFields(
  format: EventFormat,
  location: EventLocationRecord | null,
  onlineUrl: string | null,
): void {
  if (format !== 'online' && !location) {
    throw new DomainError('EVENTS_LOCATION_REQUIRED', 'An in-person event needs a place');
  }
  if (format !== 'in_person' && !onlineUrl) {
    throw new DomainError('EVENTS_ONLINE_URL_REQUIRED', 'An online event needs a link');
  }
}

export function assertDescription(description: string): void {
  const reason = restrictedMarkdownViolation(description);
  if (reason) {
    throw new DomainError('EVENTS_DESCRIPTION_INVALID', `Markdown not allowed: ${reason}`);
  }
}

/**
 * Same rule as publications (ADR 0031): `public` needs a public organizer, the public page of
 * the member or an organization (always public). Read-time rule too: a member who disables
 * their public page makes their public events visible to members only.
 */
export function effectiveVisibility(
  visibility: EventVisibility,
  organizerIsPublic: boolean,
): EventVisibility {
  return visibility === 'public' && organizerIsPublic ? 'public' : 'members';
}

export function assertPublicAllowed(visibility: EventVisibility, organizerIsPublic: boolean): void {
  if (visibility === 'public' && !organizerIsPublic) {
    throw new DomainError('EVENTS_PUBLIC_NOT_ALLOWED', 'A public event needs a public organizer');
  }
}

/** Registrations open from publication to the start. */
export function isRegistrationOpen(event: EventRecord, now: Date): boolean {
  return (
    event.status === 'published' &&
    event.moderationStatus === 'visible' &&
    now.getTime() < event.startsAt.getTime()
  );
}

/** Countries of an event: the country of its place first, then the declared ones. */
export function countriesOf(location: EventLocationRecord | null, declared: readonly string[]) {
  return [...new Set([...(location ? [location.countryCode] : []), ...declared])];
}

export const EVENT_SLUG_MIN_LENGTH = 3;
export const EVENT_SLUG_MAX_LENGTH = 80;

const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'by-slug',
  'calendar',
  'event',
  'events',
  'me',
  'new',
  'pitchorium',
  'public',
]);

export function slugBaseFromTitle(title: string): string {
  return slugify(title, {
    minLength: EVENT_SLUG_MIN_LENGTH,
    maxLength: EVENT_SLUG_MAX_LENGTH,
    fallback: 'event-page',
    reserved: RESERVED_SLUGS,
  });
}

export function assertSlugAllowed(slug: string): void {
  if (!EVENT_SLUG_PATTERN.test(slug)) {
    throw new DomainError('VALIDATION_FAILED', 'Malformed event slug');
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new DomainError('EVENTS_SLUG_RESERVED', 'Event slug is reserved');
  }
}
