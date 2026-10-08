import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  EventAttendee,
  EventCard,
  EventListQuery,
  EventOrganizer,
  EventView,
  MyEventRole,
} from '@pitchorium/contracts';
import { Clock, decodeKeyset, encodeKeyset } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { type EventRecord, effectiveVisibility } from '../domain/event';
import { isFull } from '../domain/registrations';
import { EventsRepository, type RegistrationRecord } from './ports';

/** Who reads: a signed-in member, or an anonymous visitor of a public page. */
export type EventReader = { kind: 'member'; viewerId: string } | { kind: 'public' };

export type EventLookup =
  { kind: 'found'; view: EventView } | { kind: 'moved'; slug: string } | { kind: 'missing' };

const MANAGER_ROLES = new Set(['owner', 'admin']);

/**
 * Reads of the events: who manages an event (its organizer, or an owner or admin of its
 * organization), what a reader may see (drafts and moderated events for managers only,
 * nothing across a block, public events only without session), cards and pages.
 */
@Injectable()
export class EventReadsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly projects: ProjectsFacade,
    private readonly media: MediaFacade,
    private readonly network: NetworkFacade,
    private readonly clock: Clock,
  ) {}

  async canManage(event: EventRecord, userId: string): Promise<boolean> {
    if (event.organizerId === userId) return true;
    if (!event.organizationId) return false;
    const role = await this.organizations.roleOf(event.organizationId, userId);
    return role !== null && MANAGER_ROLES.has(role);
  }

  /** An organization is public; a member is public with their public page (ADR 0031). */
  async organizerIsPublic(event: Pick<EventRecord, 'organizerId' | 'organizationId'>) {
    if (event.organizationId) return true;
    const card = (await this.profiles.memberCards([event.organizerId])).get(event.organizerId);
    return card?.publicPageEnabled === true;
  }

  async visibilityOf(event: EventRecord) {
    return effectiveVisibility(event.visibility, await this.organizerIsPublic(event));
  }

  /** Whether the reader may see the event; managers see their drafts and moderated events. */
  async canSee(event: EventRecord, reader: EventReader): Promise<boolean> {
    if (event.deletedAt) return false;
    if (reader.kind === 'member' && (await this.canManage(event, reader.viewerId))) return true;
    if (event.status === 'draft' || event.moderationStatus !== 'visible') return false;
    if (reader.kind === 'public') return (await this.visibilityOf(event)) === 'public';
    return !(await this.network.isBlockedBetween(reader.viewerId, event.organizerId));
  }

  async byId(eventId: string, reader: EventReader): Promise<EventView | null> {
    const event = await this.events.findEvent(eventId);
    if (!event || !(await this.canSee(event, reader))) return null;
    return this.view(event, reader);
  }

  async bySlug(slug: string, reader: EventReader): Promise<EventLookup> {
    const resolved = await this.events.resolveSlug(slug);
    const event = resolved ? await this.events.findEvent(resolved.eventId) : null;
    if (!event || !(await this.canSee(event, reader))) return { kind: 'missing' };
    if (!resolved?.current) return { kind: 'moved', slug: event.slug };
    return { kind: 'found', view: await this.view(event, reader) };
  }

  /** Upcoming and ongoing events, the soonest end first; public ones only without session. */
  async list(query: EventListQuery, reader: EventReader): Promise<CursorPage<EventCard>> {
    const hidden =
      reader.kind === 'member' ? await this.network.blockedUserIds(reader.viewerId) : [];
    const rows = await this.events.listPublished(
      {
        countryCode: query.countryCode,
        sectorCode: query.sectorCode,
        format: query.format,
        language: query.language,
        endingAfter: query.from ? new Date(query.from) : this.clock.now(),
        publicOnly: reader.kind === 'public',
        hiddenOrganizerIds: hidden,
      },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    // Without session, a member's public event is public only with their public page: such a
    // page may hold fewer items, the cursor still follows the rows read.
    const shown = [];
    for (const row of page) {
      if (reader.kind === 'member' || (await this.visibilityOf(row)) === 'public') shown.push(row);
    }
    const last = page.at(-1);
    return {
      items: await this.cards(shown),
      nextCursor:
        rows.length > query.limit && last ? encodeKeyset({ at: last.endsAt, key: last.id }) : null,
    };
  }

  async mine(
    userId: string,
    role: MyEventRole,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<EventCard>> {
    const after = decodeKeyset(query.cursor);
    const rows =
      role === 'organizer'
        ? await this.events.organizedBy(
            userId,
            await this.managedOrganizationIds(userId),
            after,
            query.limit + 1,
          )
        : await this.events.attendedBy(userId, after, query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.cards(page),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({
              at: role === 'organizer' ? last.createdAt : last.startsAt,
              key: last.id,
            })
          : null,
    };
  }

  /**
   * Attendees: the organizer sees every registration, waiting list included; an attendee
   * sees the registered members who agreed to be shown.
   */
  async attendees(
    event: EventRecord,
    viewerId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<EventAttendee>> {
    const manager = await this.canManage(event, viewerId);
    const rows = await this.events.attendees(
      event.id,
      manager
        ? { statuses: ['registered', 'waitlisted'], shownOnly: false }
        : { statuses: ['registered'], shownOnly: true },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const cards = await this.profiles.memberCards(
      page.map((row) => row.userId),
      viewerId,
    );
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const card = cards.get(row.userId);
        return card
          ? [
              {
                member: {
                  handle: card.handle,
                  displayName: card.displayName,
                  headline: card.headline,
                  avatarUrl: card.avatarUrl,
                },
                status: row.status,
                registeredAt: row.registeredAt.toISOString(),
              },
            ]
          : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.registeredAt, key: last.userId })
          : null,
    };
  }

  /** Cards in the given order (lists, feed, search). */
  async cards(events: readonly EventRecord[]): Promise<EventCard[]> {
    const [organizers, images] = await Promise.all([
      this.organizers(events),
      this.media.images(events.map((event) => event.imageMediaId)),
    ]);
    return events.flatMap((event) => {
      const organizer = organizers.get(event.id);
      if (!organizer) return [];
      return [
        {
          id: event.id,
          slug: event.slug,
          title: event.title,
          format: event.format,
          status: event.status,
          startsAt: event.startsAt.toISOString(),
          endsAt: event.endsAt.toISOString(),
          timeZone: event.timeZone,
          city: event.location?.city ?? null,
          countryCode: event.location?.countryCode ?? event.countryCodes[0] ?? null,
          language: event.language,
          sectorCodes: event.sectorCodes,
          imageUrl: event.imageMediaId ? (images.get(event.imageMediaId)?.url ?? null) : null,
          organizer,
          capacity: event.capacity,
          registeredCount: event.registeredCount,
          full: isFull(event.capacity, event.registeredCount),
        },
      ];
    });
  }

  async view(event: EventRecord, reader: EventReader): Promise<EventView> {
    const [card] = await this.cards([event]);
    const viewerId = reader.kind === 'member' ? reader.viewerId : null;
    const [registration, manager, project, visibility] = await Promise.all([
      viewerId ? this.events.findRegistration(event.id, viewerId) : Promise.resolve(null),
      viewerId ? this.canManage(event, viewerId) : Promise.resolve(false),
      event.projectId ? this.projects.fundable(event.projectId) : Promise.resolve(null),
      this.visibilityOf(event),
    ]);
    const revealLink = manager || registration?.status === 'registered';
    return {
      ...card!,
      description: event.description,
      visibility,
      location: event.location,
      onlineUrl: revealLink ? event.onlineUrl : null,
      countryCodes: event.countryCodes,
      imageMediaId: manager ? event.imageMediaId : null,
      waitlistCount: event.waitlistCount,
      project:
        project?.showable === true
          ? { id: project.id, slug: project.slug, title: project.title }
          : null,
      publishedAt: event.publishedAt?.toISOString() ?? null,
      canceledAt: event.canceledAt?.toISOString() ?? null,
      cancelReason: event.cancelReason,
      viewer: viewerId
        ? {
            registration: registration?.status ?? null,
            waitlistPosition: await this.positionOf(registration),
            showInAttendees: registration?.showInAttendees ?? false,
            canManage: manager,
          }
        : null,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private async positionOf(registration: RegistrationRecord | null): Promise<number | null> {
    if (registration?.status !== 'waitlisted') return null;
    return this.events.waitlistPosition(registration.eventId, registration.userId);
  }

  private async organizers(events: readonly EventRecord[]): Promise<Map<string, EventOrganizer>> {
    const [members, organizations] = await Promise.all([
      this.profiles.memberCards([
        ...new Set(events.filter((e) => !e.organizationId).map((e) => e.organizerId)),
      ]),
      this.organizations.cards([
        ...new Set(events.flatMap((e) => (e.organizationId ? [e.organizationId] : []))),
      ]),
    ]);
    const result = new Map<string, EventOrganizer>();
    for (const event of events) {
      if (event.organizationId) {
        const card = organizations.get(event.organizationId);
        if (card) {
          result.set(event.id, {
            kind: 'organization',
            organization: {
              id: card.id,
              slug: card.slug,
              name: card.name,
              logoUrl: card.logoUrl,
              verified: card.verified,
            },
          });
        }
        continue;
      }
      const card = members.get(event.organizerId);
      if (card) {
        result.set(event.id, {
          kind: 'member',
          member: {
            handle: card.handle,
            displayName: card.displayName,
            headline: card.headline,
            avatarUrl: card.avatarUrl,
          },
        });
      }
    }
    return result;
  }

  /** Organizations the member may organize for (owner or admin). */
  async managedOrganizationIds(userId: string): Promise<string[]> {
    return this.organizations.managedBy(userId);
  }
}
