import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  EventCard,
  EventModerationStatus,
  EventRegistrationStatus,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ContentFacade } from '../../content';
import { MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { ORGANIZATION_FOLLOW_TARGET, OrganizationsFacade } from '../../organizations';
import { EventUpdated } from '../domain/event-events';
import { EventEventsRecorder } from './event-events.recorder';
import { EventReadsService } from './event-reads.service';
import { EventsRepository } from './ports';

/** What the discovery module indexes of an event (ADR 0065). */
export interface EventDiscoverySource {
  id: string;
  slug: string;
  title: string;
  description: string;
  format: string;
  status: string;
  /** Visibility in force (`public` only with a public organizer). */
  visibility: 'public' | 'members';
  organizerId: string;
  organizationName: string | null;
  city: string | null;
  countryCodes: string[];
  sectorCodes: string[];
  language: string;
  startsAt: Date;
  endsAt: Date;
  publishedAt: Date | null;
}

/** An event as the notifications module names it. */
export interface EventSummary {
  id: string;
  slug: string;
  title: string;
  organizerId: string;
  startsAt: Date;
}

/**
 * Public facade of the events module: sources of the search index (discovery), attendees and
 * reminders (notifications), moderation (trust). At startup it gives content the events of
 * the followed organizers (`event` items of the feed).
 */
@Injectable()
export class EventsFacade implements OnModuleInit {
  constructor(
    private readonly events: EventsRepository,
    private readonly reads: EventReadsService,
    private readonly recorder: EventEventsRecorder,
    private readonly content: ContentFacade,
    private readonly network: NetworkFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly media: MediaFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.content.registerEventsFeedSource({
      entries: async (viewerId, after, limit) => {
        const [members, organizations, blocked] = await Promise.all([
          this.network.followedMemberIds(viewerId),
          this.network.followedIds(viewerId, ORGANIZATION_FOLLOW_TARGET),
          this.network.blockedUserIds(viewerId),
        ]);
        const hidden = new Set(blocked);
        return this.events.feedEntries(
          members.filter((id) => !hidden.has(id)),
          organizations,
          after,
          limit,
        );
      },
      present: async (viewerId, ids) => {
        const visible = [];
        for (const event of await this.events.findEvents(ids)) {
          if (await this.reads.canSee(event, { kind: 'member', viewerId })) visible.push(event);
        }
        return new Map((await this.reads.cards(visible)).map((card) => [card.id, card]));
      },
    });
  }

  /**
   * Indexable events: published, canceled excluded, completed kept (past events), visible and
   * not deleted. Others are absent: the index drops them.
   */
  async discoverySources(ids: readonly string[]): Promise<EventDiscoverySource[]> {
    const events = (await this.events.findEvents(ids)).filter(
      (event) =>
        !event.deletedAt &&
        event.moderationStatus === 'visible' &&
        (event.status === 'published' || event.status === 'completed'),
    );
    const organizations = await this.organizations.summaries(
      events.flatMap((event) => (event.organizationId ? [event.organizationId] : [])),
    );
    const sources: EventDiscoverySource[] = [];
    for (const event of events) {
      sources.push({
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        format: event.format,
        status: event.status,
        visibility: await this.reads.visibilityOf(event),
        organizerId: event.organizerId,
        organizationName: event.organizationId
          ? (organizations.get(event.organizationId)?.name ?? null)
          : null,
        city: event.location?.city ?? null,
        countryCodes: event.countryCodes,
        sectorCodes: event.sectorCodes,
        language: event.language,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        publishedAt: event.publishedAt,
      });
    }
    return sources;
  }

  /** Ids of the events that are not deleted, by ascending id, for a full rebuild of the index. */
  idsAfter(after: string | null, limit: number): Promise<string[]> {
    return this.events.idsAfter(after, limit);
  }

  /** Cards of the events as an anonymous visitor or a member sees them (search, Discover). */
  async cards(ids: readonly string[]): Promise<Map<string, EventCard>> {
    const events = await this.events.findEvents(ids);
    return new Map((await this.reads.cards(events)).map((card) => [card.id, card]));
  }

  async summaries(ids: readonly string[]): Promise<Map<string, EventSummary>> {
    return new Map(
      (await this.events.findEvents(ids))
        .filter((event) => !event.deletedAt)
        .map((event) => [
          event.id,
          {
            id: event.id,
            slug: event.slug,
            title: event.title,
            organizerId: event.organizerId,
            startsAt: event.startsAt,
          },
        ]),
    );
  }

  /** Members of the event with a seat, or on the waiting list too. */
  attendeeIds(eventId: string, statuses: readonly EventRegistrationStatus[]): Promise<string[]> {
    return this.events.registeredUserIds(eventId, statuses);
  }

  /** Published events starting within the window (reminders of the notifications module). */
  async startingBetween(from: Date, to: Date): Promise<EventSummary[]> {
    return (await this.events.startingBetween(from, to)).map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      organizerId: event.organizerId,
      startsAt: event.startsAt,
    }));
  }

  /** For the trust module: a hidden or removed event leaves the lists, the feed and the index. */
  setModerationStatus(eventId: string, status: EventModerationStatus): Promise<void> {
    return this.transactions.run(async () => {
      const event = await this.events.lockEvent(eventId);
      if (!event) return;
      await this.events.setModerationStatus(eventId, status, this.clock.now());
      const isPublic =
        status === 'visible' &&
        event.status !== 'draft' &&
        (await this.reads.visibilityOf(event)) === 'public';
      await this.media.setResourceVisibility(
        { type: 'event', id: eventId },
        isPublic ? 'public' : 'private',
      );
      await this.recorder.record(EventUpdated, eventId, { fields: ['moderationStatus'] });
    });
  }
}
