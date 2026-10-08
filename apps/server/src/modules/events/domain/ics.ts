/**
 * iCalendar (RFC 5545) export of events: one VEVENT per event, instants in UTC (the form every
 * calendar reads without a VTIMEZONE block), the time zone of the place given in the
 * description. Lines end with CRLF and are folded at 75 octets.
 */
export interface IcsEvent {
  /** Stable identifier: `<event id>@pitchorium`. */
  uid: string;
  /** Incremented by each change, so that calendars replace their copy. */
  sequence: number;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  location: string | null;
  url: string;
  canceled: boolean;
  updatedAt: Date;
}

const LINE_LIMIT = 75;

/** `20261112T170000Z` */
export function icsDateTime(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** TEXT value (RFC 5545 3.3.11): backslash, semicolon, comma and line breaks are escaped. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets without cutting a UTF-8 character (RFC 5545 3.1). */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    const limit = parts.length === 0 ? LINE_LIMIT : LINE_LIMIT - 1;
    if (size + bytes > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += character;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/**
 * Local date and time of an instant in a time zone, for the description:
 * `2026-11-12 18:00 (Africa/Dakar)`.
 */
export function localDateTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')} (${timeZone})`;
}

function vevent(event: IcsEvent, now: Date): string[] {
  const local = `${localDateTime(event.startsAt, event.timeZone)} - ${localDateTime(event.endsAt, event.timeZone)}`;
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `LAST-MODIFIED:${icsDateTime(event.updatedAt)}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTART:${icsDateTime(event.startsAt)}`,
    `DTEND:${icsDateTime(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(`${local}\n\n${event.description}`.trim())}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    `URL:${event.url}`,
    `STATUS:${event.canceled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ];
}

/** A whole calendar: one event (download) or a member's registrations (subscription). */
export function calendar(name: string, events: readonly IcsEvent[], now: Date): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pitchorium//Events//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events.flatMap((event) => vevent(event, now)),
    'END:VCALENDAR',
  ];
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}
