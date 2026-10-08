/**
 * Wall time in a time zone, to and from an instant (ISO 8601 in UTC), with the Intl API only:
 * an event happens at 18:00 in Dakar whoever reads it, and is stored as an instant.
 */

interface WallTime {
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:MM`, 24 hours. */
  time: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(zone, formatter);
  }
  return formatter;
}

function partsAt(epoch: number, zone: string): Record<string, number> {
  return Object.fromEntries(
    formatterOf(zone)
      .formatToParts(new Date(epoch))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
}

/** Offset of the zone from UTC at that instant, in milliseconds (Paris in summer: +2 hours). */
export function zoneOffset(epoch: number, zone: string): number {
  const parts = partsAt(epoch, zone);
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return asUtc - Math.floor(epoch / 1000) * 1000;
}

/**
 * Instant of a wall time in a zone. A time skipped by a change to summer time moves forward by
 * the gap; a repeated one takes its first occurrence.
 */
export function wallTimeToInstant({ date, time }: WallTime, zone: string): string {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // The offsets on either side of a possible change of the clocks around that day.
  const before = guess - zoneOffset(guess - 12 * 3600_000, zone);
  const after = guess - zoneOffset(guess + 12 * 3600_000, zone);
  const valid = [before, after].filter((candidate) => {
    const wall = instantToWallTime(new Date(candidate).toISOString(), zone);
    return wall.date === date && wall.time === time;
  });
  // Repeated: the first one; skipped: the offset before the change, which lands after the gap.
  return new Date(valid.length > 0 ? Math.min(...valid) : before).toISOString();
}

/** Wall time of an instant in a zone. */
export function instantToWallTime(instant: string, zone: string): WallTime {
  const parts = partsAt(Date.parse(instant), zone);
  const pad = (value: number | undefined) => String(value ?? 0).padStart(2, '0');
  return {
    date: `${parts.year ?? 1970}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/** Name and offset of a zone for a person (`heure d’été d’Europe centrale, UTC+2`). */
export function zoneLabel(zone: string, locale: string, at = Date.now()): string {
  const name = (style: 'long' | 'shortOffset') =>
    new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: style })
      .formatToParts(new Date(at))
      .find((part) => part.type === 'timeZoneName')?.value ?? zone;
  const offset = name('shortOffset').replace('GMT', 'UTC');
  return `${name('long')}, ${offset === 'UTC' ? 'UTC+0' : offset}`;
}
