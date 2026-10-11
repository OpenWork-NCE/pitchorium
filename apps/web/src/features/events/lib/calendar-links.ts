import type { EventLocation } from '@pitchorium/contracts';

/** `20261014T180000Z`: an instant as Google Calendar and iCalendar read it, in UTC. */
export function utcStamp(instant: string): string {
  return new Date(instant)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** The place of an event in one line: name, address, city. */
export function placeText(location: EventLocation | null): string | null {
  if (!location) return null;
  return [location.name, location.address, location.city].filter(Boolean).join(', ');
}

/**
 * « Ajouter à Google Agenda »: the template address of Google Calendar, built here without any
 * script of Google (FRONT 7): title, instants in UTC with the zone of the event, the address of
 * the page in the details, the place. The link of an online event is never in it: it stays with
 * the registered members (ADR 0069).
 */
export function googleCalendarUrl(event: {
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: EventLocation | null;
  pageUrl: string;
}): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt)}`,
    ctz: event.timeZone,
    details: event.pageUrl,
  });
  const place = placeText(event.location);
  if (place) params.set('location', place);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * A map of the place, by a plain link to OpenStreetMap (a search of its text): no map nor script
 * of a third party in the page.
 */
export function mapUrl(location: EventLocation): string {
  const query = [location.name, location.address, location.city, location.countryCode]
    .filter(Boolean)
    .join(', ');
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}
