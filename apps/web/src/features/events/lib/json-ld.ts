import { parseAbsolute } from '@internationalized/date';
import type { EventView } from '@pitchorium/contracts';
import type { Event, WithContext } from 'schema-dts';

/** An instant written with the offset of the zone of the event (`2026-10-14T18:00:00+00:00`). */
export function zonedIso(instant: string, zone: string): string {
  return parseAbsolute(new Date(instant).toISOString(), zone)
    .toString()
    .replace(/\[.*\]$/, '');
}

const MODES = {
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  online: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
} as const;

/** The first paragraph of the description, without its Markdown, for search engines. */
function plain(markdown: string): string {
  const text = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 300 ? `${text.slice(0, 297)}…` : text;
}

/**
 * Structured data of the public page of an event (FRONT 7): an `Event` of schema.org with its
 * attendance mode, its physical place or a virtual one (the page itself: the link of the meeting
 * stays with the registered members), its dates with the offset of its zone, its status, its
 * organizer and its image. Free events: no offer, no price.
 */
export function eventJsonLd(
  event: EventView,
  options: { url: string; siteUrl: string; organizerUrl: string },
): WithContext<Event> {
  const physical = event.location
    ? {
        '@type': 'Place' as const,
        name: event.location.name,
        address: {
          '@type': 'PostalAddress' as const,
          ...(event.location.address ? { streetAddress: event.location.address } : {}),
          addressLocality: event.location.city,
          addressCountry: event.location.countryCode,
        },
      }
    : null;
  const virtual = { '@type': 'VirtualLocation' as const, url: options.url };
  const location =
    event.format === 'online'
      ? virtual
      : event.format === 'hybrid' && physical
        ? [physical, virtual]
        : physical;
  const organizer =
    event.organizer.kind === 'member'
      ? {
          '@type': 'Person' as const,
          name: event.organizer.member.displayName,
          url: options.organizerUrl,
        }
      : {
          '@type': 'Organization' as const,
          name: event.organizer.organization.name,
          url: options.organizerUrl,
        };
  const description = plain(event.description);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    ...(description ? { description } : {}),
    url: options.url,
    startDate: zonedIso(event.startsAt, event.timeZone),
    endDate: zonedIso(event.endsAt, event.timeZone),
    eventAttendanceMode: MODES[event.format],
    eventStatus:
      event.status === 'canceled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    ...(location ? { location } : {}),
    image: event.imageUrl ? [event.imageUrl] : [`${options.siteUrl}/brand/app-icon-dark-512.png`],
    organizer,
    inLanguage: event.language,
    isAccessibleForFree: true,
    ...(event.capacity !== null ? { maximumAttendeeCapacity: event.capacity } : {}),
  };
}
