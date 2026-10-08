import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CreateEventRequest, UpdateEventRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator, slugCandidates } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import {
  assertDescription,
  assertDraft,
  assertEditable,
  assertFormatFields,
  assertPublicAllowed,
  assertSchedule,
  assertSlugAllowed,
  assertTransition,
  countriesOf,
  effectiveVisibility,
  type EventLocationRecord,
  type EventRecord,
  slugBaseFromTitle,
} from '../domain/event';
import {
  EventCanceled,
  EventCreated,
  EventPublished,
  EventUpdated,
  RegistrationPromoted,
} from '../domain/event-events';
import { assertCapacity, promotions } from '../domain/registrations';
import { EventEventsRecorder } from './event-events.recorder';
import { EventReadsService } from './event-reads.service';
import { EventsRepository } from './ports';

export const EVENT_RESOURCE = 'event';
const IMAGE_USAGE = 'event_image';

/** Fields whose change matters to the attendees: their calendar copy is replaced. */
const SCHEDULE_FIELDS = new Set([
  'title',
  'startsAt',
  'endsAt',
  'timeZone',
  'location',
  'onlineUrl',
  'format',
  'description',
]);

/**
 * Writes of the events (ADR 0069): a member organizes for themself or for an organization they
 * own or administer, attaches the event to a project of their team, publishes, edits, cancels.
 */
@Injectable()
export class EventsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly reads: EventReadsService,
    private readonly recorder: EventEventsRecorder,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly projects: ProjectsFacade,
    private readonly media: MediaFacade,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, request: CreateEventRequest): Promise<EventRecord> {
    if (request.organizationId) {
      const role = await this.organizations.roleOf(request.organizationId, userId);
      if (role !== 'owner' && role !== 'admin') {
        throw new DomainError(
          'EVENTS_ORGANIZATION_ROLE_REQUIRED',
          'Owner or admin of the organization required',
        );
      }
    }
    if (request.projectId) await this.assertProjectTeam(request.projectId, userId);
    const startsAt = new Date(request.startsAt);
    const endsAt = new Date(request.endsAt);
    assertSchedule(startsAt, endsAt, null);
    const location = request.location;
    assertFormatFields(request.format, location, request.onlineUrl);
    assertDescription(request.description);
    const countryCodes = countriesOf(location, request.countryCodes);
    await this.profiles.assertCountries(countryCodes);
    await this.profiles.assertSectors(request.sectorCodes);
    const now = this.clock.now();
    const id = this.ids.next();
    return this.transactions.run(async () => {
      const base = slugBaseFromTitle(request.title);
      let slug: string | null = null;
      for (const candidate of slugCandidates(base, () => randomInt(1000, 1_000_000))) {
        if (!(await this.events.isSlugUnavailable(candidate, null))) {
          slug = candidate;
          break;
        }
      }
      if (!slug) throw new Error(`No slug available for event ${request.title}`);
      const event: EventRecord = {
        id,
        slug,
        organizerId: userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        title: request.title,
        description: request.description,
        format: request.format,
        status: 'draft',
        visibility: request.visibility,
        startsAt,
        endsAt,
        timeZone: request.timeZone,
        location,
        onlineUrl: request.onlineUrl,
        language: request.language,
        sectorCodes: request.sectorCodes,
        countryCodes,
        imageMediaId: null,
        capacity: request.capacity,
        registeredCount: 0,
        waitlistCount: 0,
        sequence: 0,
        moderationStatus: 'visible',
        cancelReason: null,
        publishedAt: null,
        canceledAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await this.events.insertEvent(event);
      if (request.imageMediaId) await this.attachImage(event, request.imageMediaId, userId);
      await this.recorder.record(EventCreated, id, {
        organizerId: userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
      });
      return { ...event, imageMediaId: request.imageMediaId };
    });
  }

  async update(eventId: string, userId: string, request: UpdateEventRequest): Promise<void> {
    const fields = Object.keys(request).filter(
      (key) => request[key as keyof UpdateEventRequest] !== undefined,
    );
    if (fields.length === 0) return;
    await this.transactions.run(async () => {
      const event = await this.require(eventId, true);
      assertEditable(event);
      const startsAt = request.startsAt ? new Date(request.startsAt) : event.startsAt;
      const endsAt = request.endsAt ? new Date(request.endsAt) : event.endsAt;
      if (request.startsAt || request.endsAt) {
        assertSchedule(startsAt, endsAt, event.status === 'published' ? this.clock.now() : null);
      }
      const format = request.format ?? event.format;
      const location: EventLocationRecord | null =
        request.location !== undefined ? request.location : event.location;
      const onlineUrl = request.onlineUrl !== undefined ? request.onlineUrl : event.onlineUrl;
      assertFormatFields(format, location, onlineUrl);
      if (request.description !== undefined) assertDescription(request.description);
      const declared = request.countryCodes ?? event.countryCodes;
      const countryCodes = countriesOf(location, declared);
      if (request.countryCodes || request.location !== undefined) {
        await this.profiles.assertCountries(countryCodes);
      }
      if (request.sectorCodes) await this.profiles.assertSectors(request.sectorCodes);
      const visibility = request.visibility ?? event.visibility;
      if (request.visibility && event.status === 'published') {
        assertPublicAllowed(visibility, await this.reads.organizerIsPublic(event));
      }
      const capacity = request.capacity !== undefined ? request.capacity : event.capacity;
      assertCapacity(capacity, event.registeredCount);
      const now = this.clock.now();
      if (request.imageMediaId !== undefined && request.imageMediaId !== event.imageMediaId) {
        if (event.imageMediaId) await this.media.detach(event.imageMediaId);
        if (request.imageMediaId) await this.attachImage(event, request.imageMediaId, userId);
      }
      const touchesCalendar = fields.some((field) => SCHEDULE_FIELDS.has(field));
      await this.events.updateEvent(eventId, {
        ...(request.title !== undefined ? { title: request.title } : {}),
        ...(request.description !== undefined ? { description: request.description } : {}),
        format,
        startsAt,
        endsAt,
        ...(request.timeZone !== undefined ? { timeZone: request.timeZone } : {}),
        location,
        onlineUrl,
        ...(request.language !== undefined ? { language: request.language } : {}),
        ...(request.sectorCodes !== undefined ? { sectorCodes: request.sectorCodes } : {}),
        countryCodes,
        ...(request.imageMediaId !== undefined ? { imageMediaId: request.imageMediaId } : {}),
        capacity,
        visibility,
        sequence: event.sequence + (event.status === 'published' && touchesCalendar ? 1 : 0),
        updatedAt: now,
      });
      if (capacity !== event.capacity) await this.promoteWaitlist({ ...event, capacity }, now);
      if (request.visibility && event.status === 'published') {
        await this.media.setResourceVisibility(
          { type: EVENT_RESOURCE, id: eventId },
          effectiveVisibility(visibility, await this.reads.organizerIsPublic(event)) === 'public'
            ? 'public'
            : 'private',
        );
      }
      await this.recorder.record(EventUpdated, eventId, { fields });
    });
  }

  async publish(eventId: string): Promise<void> {
    await this.transactions.run(async () => {
      const event = await this.require(eventId, true);
      assertTransition(event.status, 'published');
      const now = this.clock.now();
      assertSchedule(event.startsAt, event.endsAt, now);
      const organizerIsPublic = await this.reads.organizerIsPublic(event);
      assertPublicAllowed(event.visibility, organizerIsPublic);
      await this.events.updateEvent(eventId, {
        status: 'published',
        publishedAt: now,
        updatedAt: now,
      });
      if (effectiveVisibility(event.visibility, organizerIsPublic) === 'public') {
        await this.media.setResourceVisibility({ type: EVENT_RESOURCE, id: eventId }, 'public');
      }
      await this.recorder.record(EventPublished, eventId, {
        organizerId: event.organizerId,
        organizationId: event.organizationId,
        startsAt: event.startsAt.toISOString(),
      });
    });
  }

  /** The registered members and the waiting list are notified (notifications module). */
  async cancel(eventId: string, userId: string, reason: string | null): Promise<void> {
    await this.transactions.run(async () => {
      const event = await this.require(eventId, true);
      assertTransition(event.status, 'canceled');
      const now = this.clock.now();
      await this.events.updateEvent(eventId, {
        status: 'canceled',
        canceledAt: now,
        cancelReason: reason,
        sequence: event.sequence + 1,
        updatedAt: now,
      });
      await this.recorder.record(EventCanceled, eventId, { by: userId });
    });
  }

  /** A draft only; its slug stays reserved and its image is detached. */
  async delete(eventId: string): Promise<void> {
    await this.transactions.run(async () => {
      const event = await this.require(eventId, true);
      assertDraft(event);
      const now = this.clock.now();
      if (event.imageMediaId) await this.media.detach(event.imageMediaId);
      await this.events.updateEvent(eventId, {
        deletedAt: now,
        imageMediaId: null,
        updatedAt: now,
      });
    });
  }

  /** Former slugs keep redirecting and are never given to another event. */
  async changeSlug(eventId: string, slug: string): Promise<void> {
    assertSlugAllowed(slug);
    await this.transactions.run(async () => {
      const event = await this.require(eventId, true);
      if (event.slug === slug) return;
      if (await this.events.isSlugUnavailable(slug, eventId)) {
        throw new DomainError('EVENTS_SLUG_TAKEN', 'Event slug is already taken');
      }
      await this.events.changeSlug(eventId, event.slug, slug, this.clock.now());
      await this.recorder.record(EventUpdated, eventId, { fields: ['slug'] });
    });
  }

  /** Free seats go to the waiting list, in its order (ADR 0070). Inside the transaction. */
  async promoteWaitlist(event: EventRecord, now: Date): Promise<string[]> {
    if (event.waitlistCount === 0) return [];
    const waiting = await this.events.waitlist(event.id, event.waitlistCount);
    const promoted = promotions(event.capacity, event.registeredCount, waiting);
    if (promoted.length === 0) return [];
    await this.events.promote(event.id, promoted, now);
    await this.events.updateEvent(event.id, {
      registeredCount: event.registeredCount + promoted.length,
      waitlistCount: event.waitlistCount - promoted.length,
    });
    for (const userId of promoted) {
      await this.recorder.record(RegistrationPromoted, event.id, { userId });
    }
    return promoted;
  }

  private async attachImage(event: EventRecord, mediaId: string, ownerId: string): Promise<void> {
    const visibility =
      event.status === 'published' &&
      effectiveVisibility(event.visibility, await this.reads.organizerIsPublic(event)) === 'public'
        ? 'public'
        : 'private';
    try {
      await this.media.attach({
        mediaId,
        ownerId,
        usage: IMAGE_USAGE,
        resource: { type: EVENT_RESOURCE, id: event.id },
        resourceVisibility: visibility,
      });
    } catch (error) {
      if (error instanceof DomainError && error.code.startsWith('MEDIA_')) {
        throw new DomainError('EVENTS_IMAGE_INVALID', error.message);
      }
      throw error;
    }
  }

  private async assertProjectTeam(projectId: string, userId: string): Promise<void> {
    if (!(await this.projects.teamRoleOf(projectId, userId))) {
      throw new DomainError('EVENTS_PROJECT_ROLE_REQUIRED', 'Member of the project team required');
    }
  }

  private async require(eventId: string, lock: boolean): Promise<EventRecord> {
    const event = lock
      ? await this.events.lockEvent(eventId)
      : await this.events.findEvent(eventId);
    if (!event || event.deletedAt) throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
    return event;
  }
}
