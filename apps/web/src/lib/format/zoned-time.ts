import {
  CalendarDate,
  CalendarDateTime,
  fromAbsolute,
  getDayOfWeek,
  parseAbsolute,
  toZoned,
} from '@internationalized/date';

/**
 * Wall time in a time zone, to and from an instant (ISO 8601 in UTC), on @internationalized/date
 * (ADR 0100): an event happens at 18:00 in Dakar whoever reads it, and is stored as an instant.
 */
export interface WallDateTime {
  year: number;
  month: number;
  day: number;
  /** 0 to 23. */
  hour: number;
  minute: number;
}

/** Days of a month of the Gregorian calendar (February of a leap year has 29). */
export function daysInMonth(year: number, month: number): number {
  const date = new CalendarDate(year, month, 1);
  return date.calendar.getDaysInMonth(date);
}

/**
 * Instant of a wall time in a zone. A time skipped by a change to summer time moves forward by
 * the gap; a repeated one takes its first occurrence (disambiguation `compatible`). A day past
 * the end of its month is brought back to the last day.
 */
export function wallTimeToInstant(wall: WallDateTime, zone: string): string {
  const day = Math.min(wall.day, daysInMonth(wall.year, wall.month));
  const local = new CalendarDateTime(wall.year, wall.month, day, wall.hour, wall.minute);
  return toZoned(local, zone, 'compatible').toAbsoluteString();
}

/** Wall time of an instant in a zone. */
export function instantToWallTime(instant: string, zone: string): WallDateTime {
  const zoned = parseAbsolute(instant, zone);
  return {
    year: zoned.year,
    month: zoned.month,
    day: zoned.day,
    hour: zoned.hour,
    minute: zoned.minute,
  };
}

/** Offset of the zone from UTC at that instant, in minutes (Paris in summer: 120). */
export function zoneOffsetMinutes(zone: string, at = Date.now()): number {
  return Math.round(fromAbsolute(at, zone).offset / 60_000);
}

/** `+0`, `+1`, `-4`, `+5:30`: the offset as it follows `GMT`. */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `${sign}${hours}${rest > 0 ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

/** City of an IANA zone (`America/Port-au-Prince` gives `Port-au-Prince`). */
export function zoneCity(zone: string): string {
  return (zone.split('/').at(-1) ?? zone).replaceAll('_', ' ');
}

/** Region of an IANA zone (`Africa`), empty for `UTC`. */
export function zoneRegion(zone: string): string {
  return zone.includes('/') ? (zone.split('/')[0] ?? '') : '';
}

/** The IANA zones of the runtime, `UTC` included. */
export function timeZones(): readonly string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes('UTC') ? zones : [...zones, 'UTC'];
}

/** First day of the week of a locale, 0 for Sunday (react-day-picker's `weekStartsOn`). */
export function weekStartOf(locale: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  // 4 January 2026 is a Sunday: its index in the week of the locale gives the first day.
  const sunday = getDayOfWeek(new CalendarDate(2026, 1, 4), locale);
  return ((7 - sunday) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
