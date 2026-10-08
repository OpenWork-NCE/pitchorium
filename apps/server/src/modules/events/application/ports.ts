import type {
  EventFormat,
  EventModerationStatus,
  EventRegistrationStatus,
} from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { EventRecord } from '../domain/event';

export interface RegistrationRecord {
  eventId: string;
  userId: string;
  status: EventRegistrationStatus;
  showInAttendees: boolean;
  registeredAt: Date;
  promotedAt: Date | null;
}

export interface EventListFilter {
  countryCode?: string | undefined;
  sectorCode?: string | undefined;
  format?: EventFormat | undefined;
  language?: string | undefined;
  /** Events ending after this instant. */
  endingAfter: Date;
  /** Published by a member whose public events are public, or by an organization. */
  publicOnly: boolean;
  /** Organizers hidden from the reader (blocks). */
  hiddenOrganizerIds: readonly string[];
}

export abstract class EventsRepository {
  /** Transaction-scoped advisory lock on a key. */
  abstract lock(key: string): Promise<void>;
  abstract insertEvent(event: EventRecord): Promise<void>;
  abstract findEvent(id: string): Promise<EventRecord | null>;
  abstract findEvents(ids: readonly string[]): Promise<EventRecord[]>;
  /** Locks the row of the event until the end of the transaction. */
  abstract lockEvent(id: string): Promise<EventRecord | null>;
  abstract updateEvent(id: string, patch: Partial<EventRecord>): Promise<void>;
  /** Current slug first, then former slugs (redirect). */
  abstract resolveSlug(slug: string): Promise<{ eventId: string; current: boolean } | null>;
  abstract isSlugUnavailable(slug: string, eventId: string | null): Promise<boolean>;
  abstract changeSlug(eventId: string, previous: string, next: string, at: Date): Promise<void>;

  /** Published and visible, ending after the filter date, the soonest first. */
  abstract listPublished(
    filter: EventListFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]>;
  /** Events created by the member or by their organizations, drafts included, newest first. */
  abstract organizedBy(
    userId: string,
    organizationIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]>;
  /** Events the member registered to (seat or waiting list), the soonest first. */
  abstract attendedBy(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]>;
  /** Published events of these organizers, newest publication first (feed). */
  abstract feedEntries(
    organizerIds: readonly string[],
    organizationIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]>;
  /** Published events that ended before this instant (completion). */
  abstract endedBefore(at: Date, limit: number): Promise<EventRecord[]>;
  /** Published and visible events starting within the window. */
  abstract startingBetween(from: Date, to: Date): Promise<EventRecord[]>;
  /** Ids of every event that is not deleted, by ascending id (reindex). */
  abstract idsAfter(after: string | null, limit: number): Promise<string[]>;
  abstract setModerationStatus(id: string, status: EventModerationStatus, at: Date): Promise<void>;

  abstract findRegistration(eventId: string, userId: string): Promise<RegistrationRecord | null>;
  abstract registrationsOf(
    userId: string,
    eventIds: readonly string[],
  ): Promise<Map<string, RegistrationRecord>>;
  abstract insertRegistration(registration: RegistrationRecord): Promise<void>;
  abstract setShowInAttendees(eventId: string, userId: string, show: boolean): Promise<void>;
  abstract deleteRegistration(eventId: string, userId: string): Promise<void>;
  /** Waiting list in order of registration, the first `limit` members. */
  abstract waitlist(eventId: string, limit: number): Promise<string[]>;
  abstract promote(eventId: string, userIds: readonly string[], at: Date): Promise<void>;
  /** Position in the waiting list, 1 for the next member promoted. */
  abstract waitlistPosition(eventId: string, userId: string): Promise<number | null>;
  abstract attendees(
    eventId: string,
    options: { statuses: readonly EventRegistrationStatus[]; shownOnly: boolean },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<RegistrationRecord[]>;
  abstract registeredUserIds(
    eventId: string,
    statuses: readonly EventRegistrationStatus[],
  ): Promise<string[]>;

  abstract setCalendarToken(userId: string, tokenHash: string, at: Date): Promise<void>;
  abstract calendarTokenCreatedAt(userId: string): Promise<Date | null>;
  abstract deleteCalendarToken(userId: string): Promise<boolean>;
  abstract userIdByCalendarToken(tokenHash: string): Promise<string | null>;
  /** Events of the member's calendar: registered, ending after the date, canceled included. */
  abstract calendarEvents(userId: string, endingAfter: Date): Promise<EventRecord[]>;
}
