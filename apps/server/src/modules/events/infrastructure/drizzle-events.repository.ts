import { Injectable } from '@nestjs/common';
import type {
  EventFormat,
  EventModerationStatus,
  EventRegistrationStatus,
  EventStatus,
  EventVisibility,
} from '@pitchorium/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from '@pitchorium/db/orm';
import {
  eventsCalendarTokens,
  eventsEvents,
  eventsRegistrations,
  eventsSlugHistory,
} from '@pitchorium/db/schemas/events';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import {
  type EventListFilter,
  EventsRepository,
  type RegistrationRecord,
} from '../application/ports';
import type { EventRecord } from '../domain/event';

type EventRow = typeof eventsEvents.$inferSelect;
type RegistrationRow = typeof eventsRegistrations.$inferSelect;

const toEvent = (row: EventRow): EventRecord => ({
  id: row.id,
  slug: row.slug,
  organizerId: row.organizerId,
  organizationId: row.organizationId,
  projectId: row.projectId,
  title: row.title,
  description: row.description,
  format: row.format as EventFormat,
  status: row.status as EventStatus,
  visibility: row.visibility as EventVisibility,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  timeZone: row.timeZone,
  location:
    row.locationName && row.locationCity && row.locationCountryCode
      ? {
          name: row.locationName,
          address: row.locationAddress,
          city: row.locationCity,
          countryCode: row.locationCountryCode,
        }
      : null,
  onlineUrl: row.onlineUrl,
  language: row.language,
  sectorCodes: row.sectorCodes,
  countryCodes: row.countryCodes,
  imageMediaId: row.imageMediaId,
  capacity: row.capacity,
  registeredCount: row.registeredCount,
  waitlistCount: row.waitlistCount,
  sequence: row.sequence,
  moderationStatus: row.moderationStatus as EventModerationStatus,
  cancelReason: row.cancelReason,
  publishedAt: row.publishedAt,
  canceledAt: row.canceledAt,
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
});

const toRegistration = (row: RegistrationRow): RegistrationRecord => ({
  ...row,
  status: row.status as EventRegistrationStatus,
});

/** Columns of a partial record (the location is flattened). */
function toRow(patch: Partial<EventRecord>): Partial<EventRow> {
  const { location, ...rest } = patch;
  return {
    ...rest,
    ...(location !== undefined
      ? {
          locationName: location?.name ?? null,
          locationAddress: location?.address ?? null,
          locationCity: location?.city ?? null,
          locationCountryCode: location?.countryCode ?? null,
        }
      : {}),
  };
}

const live = and(
  eq(eventsEvents.status, 'published'),
  isNull(eventsEvents.deletedAt),
  eq(eventsEvents.moderationStatus, 'visible'),
);

@Injectable()
export class DrizzleEventsRepository extends EventsRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertEvent(event: EventRecord): Promise<void> {
    await this.db.insert(eventsEvents).values(toRow(event) as EventRow);
  }

  async findEvent(id: string): Promise<EventRecord | null> {
    const [row] = await this.db.select().from(eventsEvents).where(eq(eventsEvents.id, id));
    return row ? toEvent(row) : null;
  }

  async findEvents(ids: readonly string[]): Promise<EventRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(eventsEvents)
      .where(inArray(eventsEvents.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, toEvent(row)]));
    return ids.flatMap((id) => {
      const event = byId.get(id);
      return event ? [event] : [];
    });
  }

  async lockEvent(id: string): Promise<EventRecord | null> {
    const [row] = await this.db
      .select()
      .from(eventsEvents)
      .where(eq(eventsEvents.id, id))
      .for('update');
    return row ? toEvent(row) : null;
  }

  async updateEvent(id: string, patch: Partial<EventRecord>): Promise<void> {
    await this.db.update(eventsEvents).set(toRow(patch)).where(eq(eventsEvents.id, id));
  }

  async resolveSlug(slug: string): Promise<{ eventId: string; current: boolean } | null> {
    const [current] = await this.db
      .select({ id: eventsEvents.id })
      .from(eventsEvents)
      .where(eq(eventsEvents.slug, slug));
    if (current) return { eventId: current.id, current: true };
    const [former] = await this.db
      .select({ eventId: eventsSlugHistory.eventId })
      .from(eventsSlugHistory)
      .where(eq(eventsSlugHistory.slug, slug));
    return former ? { eventId: former.eventId, current: false } : null;
  }

  async isSlugUnavailable(slug: string, eventId: string | null): Promise<boolean> {
    const [current] = await this.db
      .select({ id: eventsEvents.id })
      .from(eventsEvents)
      .where(eq(eventsEvents.slug, slug));
    if (current) return current.id !== eventId;
    const [former] = await this.db
      .select({ eventId: eventsSlugHistory.eventId })
      .from(eventsSlugHistory)
      .where(eq(eventsSlugHistory.slug, slug));
    return former !== undefined && former.eventId !== eventId;
  }

  async changeSlug(eventId: string, previous: string, next: string, at: Date): Promise<void> {
    // A former slug of the same event becomes current again.
    await this.db.delete(eventsSlugHistory).where(eq(eventsSlugHistory.slug, next));
    await this.db
      .insert(eventsSlugHistory)
      .values({ slug: previous, eventId, replacedAt: at })
      .onConflictDoNothing();
    await this.db
      .update(eventsEvents)
      .set({ slug: next, updatedAt: at })
      .where(eq(eventsEvents.id, eventId));
  }

  async listPublished(
    filter: EventListFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]> {
    const rows = await this.db
      .select()
      .from(eventsEvents)
      .where(
        and(
          live,
          gt(eventsEvents.endsAt, filter.endingAfter),
          filter.countryCode
            ? sql`${filter.countryCode} = any(${eventsEvents.countryCodes})`
            : undefined,
          filter.sectorCode
            ? sql`${filter.sectorCode} = any(${eventsEvents.sectorCodes})`
            : undefined,
          filter.format ? eq(eventsEvents.format, filter.format) : undefined,
          filter.language ? eq(eventsEvents.language, filter.language) : undefined,
          filter.publicOnly ? eq(eventsEvents.visibility, 'public') : undefined,
          filter.hiddenOrganizerIds.length > 0
            ? notInArray(eventsEvents.organizerId, [...filter.hiddenOrganizerIds])
            : undefined,
          after
            ? sql`(${eventsEvents.endsAt}, ${eventsEvents.id}) > (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(asc(eventsEvents.endsAt), asc(eventsEvents.id))
      .limit(limit);
    return rows.map(toEvent);
  }

  async organizedBy(
    userId: string,
    organizationIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]> {
    const rows = await this.db
      .select()
      .from(eventsEvents)
      .where(
        and(
          isNull(eventsEvents.deletedAt),
          or(
            eq(eventsEvents.organizerId, userId),
            organizationIds.length > 0
              ? inArray(eventsEvents.organizationId, [...organizationIds])
              : undefined,
          ),
          after
            ? sql`(${eventsEvents.createdAt}, ${eventsEvents.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(eventsEvents.createdAt), desc(eventsEvents.id))
      .limit(limit);
    return rows.map(toEvent);
  }

  async attendedBy(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EventRecord[]> {
    const rows = await this.db
      .select({ event: eventsEvents })
      .from(eventsRegistrations)
      .innerJoin(eventsEvents, eq(eventsEvents.id, eventsRegistrations.eventId))
      .where(
        and(
          eq(eventsRegistrations.userId, userId),
          isNull(eventsEvents.deletedAt),
          after
            ? sql`(${eventsEvents.startsAt}, ${eventsEvents.id}) > (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(asc(eventsEvents.startsAt), asc(eventsEvents.id))
      .limit(limit);
    return rows.map((row) => toEvent(row.event));
  }

  async feedEntries(
    organizerIds: readonly string[],
    organizationIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]> {
    if (organizerIds.length === 0 && organizationIds.length === 0) return [];
    const rows = await this.db
      .select({ id: eventsEvents.id, createdAt: eventsEvents.publishedAt })
      .from(eventsEvents)
      .where(
        and(
          live,
          or(
            organizerIds.length > 0
              ? and(
                  inArray(eventsEvents.organizerId, [...organizerIds]),
                  isNull(eventsEvents.organizationId),
                )
              : undefined,
            organizationIds.length > 0
              ? inArray(eventsEvents.organizationId, [...organizationIds])
              : undefined,
          ),
          after
            ? sql`(${eventsEvents.publishedAt}, ${eventsEvents.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(eventsEvents.publishedAt), desc(eventsEvents.id))
      .limit(limit);
    return rows.flatMap((row) => (row.createdAt ? [{ id: row.id, createdAt: row.createdAt }] : []));
  }

  async endedBefore(at: Date, limit: number): Promise<EventRecord[]> {
    const rows = await this.db
      .select()
      .from(eventsEvents)
      .where(
        and(
          eq(eventsEvents.status, 'published'),
          isNull(eventsEvents.deletedAt),
          lte(eventsEvents.endsAt, at),
        ),
      )
      .orderBy(asc(eventsEvents.endsAt))
      .limit(limit);
    return rows.map(toEvent);
  }

  async startingBetween(from: Date, to: Date): Promise<EventRecord[]> {
    const rows = await this.db
      .select()
      .from(eventsEvents)
      .where(and(live, gt(eventsEvents.startsAt, from), lte(eventsEvents.startsAt, to)))
      .orderBy(asc(eventsEvents.startsAt));
    return rows.map(toEvent);
  }

  async idsAfter(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: eventsEvents.id })
      .from(eventsEvents)
      .where(and(isNull(eventsEvents.deletedAt), after ? gt(eventsEvents.id, after) : undefined))
      .orderBy(asc(eventsEvents.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async setModerationStatus(id: string, status: EventModerationStatus, at: Date): Promise<void> {
    await this.db
      .update(eventsEvents)
      .set({ moderationStatus: status, updatedAt: at })
      .where(eq(eventsEvents.id, id));
  }

  async findRegistration(eventId: string, userId: string): Promise<RegistrationRecord | null> {
    const [row] = await this.db
      .select()
      .from(eventsRegistrations)
      .where(and(eq(eventsRegistrations.eventId, eventId), eq(eventsRegistrations.userId, userId)));
    return row ? toRegistration(row) : null;
  }

  async registrationsOf(
    userId: string,
    eventIds: readonly string[],
  ): Promise<Map<string, RegistrationRecord>> {
    if (eventIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(eventsRegistrations)
      .where(
        and(
          eq(eventsRegistrations.userId, userId),
          inArray(eventsRegistrations.eventId, [...eventIds]),
        ),
      );
    return new Map(rows.map((row) => [row.eventId, toRegistration(row)]));
  }

  async insertRegistration(registration: RegistrationRecord): Promise<void> {
    await this.db.insert(eventsRegistrations).values(registration);
  }

  async setShowInAttendees(eventId: string, userId: string, show: boolean): Promise<void> {
    await this.db
      .update(eventsRegistrations)
      .set({ showInAttendees: show })
      .where(and(eq(eventsRegistrations.eventId, eventId), eq(eventsRegistrations.userId, userId)));
  }

  async deleteRegistration(eventId: string, userId: string): Promise<void> {
    await this.db
      .delete(eventsRegistrations)
      .where(and(eq(eventsRegistrations.eventId, eventId), eq(eventsRegistrations.userId, userId)));
  }

  async waitlist(eventId: string, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ userId: eventsRegistrations.userId })
      .from(eventsRegistrations)
      .where(
        and(eq(eventsRegistrations.eventId, eventId), eq(eventsRegistrations.status, 'waitlisted')),
      )
      .orderBy(asc(eventsRegistrations.registeredAt), asc(eventsRegistrations.userId))
      .limit(limit);
    return rows.map((row) => row.userId);
  }

  async promote(eventId: string, userIds: readonly string[], at: Date): Promise<void> {
    if (userIds.length === 0) return;
    await this.db
      .update(eventsRegistrations)
      .set({ status: 'registered', promotedAt: at })
      .where(
        and(
          eq(eventsRegistrations.eventId, eventId),
          inArray(eventsRegistrations.userId, [...userIds]),
        ),
      );
  }

  async waitlistPosition(eventId: string, userId: string): Promise<number | null> {
    const registration = await this.findRegistration(eventId, userId);
    if (registration?.status !== 'waitlisted') return null;
    const [row] = await this.db
      .select({ ahead: count() })
      .from(eventsRegistrations)
      .where(
        and(
          eq(eventsRegistrations.eventId, eventId),
          eq(eventsRegistrations.status, 'waitlisted'),
          sql`(${eventsRegistrations.registeredAt}, ${eventsRegistrations.userId}) < (${registration.registeredAt}, ${userId}::uuid)`,
        ),
      );
    return (row?.ahead ?? 0) + 1;
  }

  async attendees(
    eventId: string,
    options: { statuses: readonly EventRegistrationStatus[]; shownOnly: boolean },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<RegistrationRecord[]> {
    const rows = await this.db
      .select()
      .from(eventsRegistrations)
      .where(
        and(
          eq(eventsRegistrations.eventId, eventId),
          inArray(eventsRegistrations.status, [...options.statuses]),
          options.shownOnly ? eq(eventsRegistrations.showInAttendees, true) : undefined,
          after
            ? sql`(${eventsRegistrations.registeredAt}, ${eventsRegistrations.userId}) > (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(asc(eventsRegistrations.registeredAt), asc(eventsRegistrations.userId))
      .limit(limit);
    return rows.map(toRegistration);
  }

  async registeredUserIds(
    eventId: string,
    statuses: readonly EventRegistrationStatus[],
  ): Promise<string[]> {
    const rows = await this.db
      .select({ userId: eventsRegistrations.userId })
      .from(eventsRegistrations)
      .where(
        and(
          eq(eventsRegistrations.eventId, eventId),
          inArray(eventsRegistrations.status, [...statuses]),
        ),
      );
    return rows.map((row) => row.userId);
  }

  async setCalendarToken(userId: string, tokenHash: string, at: Date): Promise<void> {
    await this.db
      .insert(eventsCalendarTokens)
      .values({ userId, tokenHash, createdAt: at })
      .onConflictDoUpdate({
        target: eventsCalendarTokens.userId,
        set: { tokenHash, createdAt: at },
      });
  }

  async calendarTokenCreatedAt(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: eventsCalendarTokens.createdAt })
      .from(eventsCalendarTokens)
      .where(eq(eventsCalendarTokens.userId, userId));
    return row?.createdAt ?? null;
  }

  async deleteCalendarToken(userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(eventsCalendarTokens)
      .where(eq(eventsCalendarTokens.userId, userId))
      .returning({ userId: eventsCalendarTokens.userId });
    return rows.length > 0;
  }

  async userIdByCalendarToken(tokenHash: string): Promise<string | null> {
    const [row] = await this.db
      .select({ userId: eventsCalendarTokens.userId })
      .from(eventsCalendarTokens)
      .where(eq(eventsCalendarTokens.tokenHash, tokenHash));
    return row?.userId ?? null;
  }

  async calendarEvents(userId: string, endingAfter: Date): Promise<EventRecord[]> {
    const rows = await this.db
      .select({ event: eventsEvents })
      .from(eventsRegistrations)
      .innerJoin(eventsEvents, eq(eventsEvents.id, eventsRegistrations.eventId))
      .where(
        and(
          eq(eventsRegistrations.userId, userId),
          eq(eventsRegistrations.status, 'registered'),
          isNull(eventsEvents.deletedAt),
          eq(eventsEvents.moderationStatus, 'visible'),
          inArray(eventsEvents.status, ['published', 'canceled', 'completed']),
          gt(eventsEvents.endsAt, endingAfter),
        ),
      )
      .orderBy(asc(eventsEvents.startsAt));
    return rows.map((row) => toEvent(row.event));
  }
}
