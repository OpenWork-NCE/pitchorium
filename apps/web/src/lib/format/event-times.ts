import { zoneCity, zoneOffsetMinutes } from './zoned-time';

export interface EventTimes {
  /** Date of the start in the zone of the event (« mardi 14 octobre 2026 »). */
  date: string;
  /** Start and end in the zone of the event (« 18:00 – 20:00 »). */
  time: string;
  /** City of the zone of the event (« Dakar »). */
  city: string;
  /**
   * The same hours in the zone of the reader when it differs at that date, with the date when
   * the day changes (« 19:00 – 21:00 », « mer. 15 oct., 01:00 – 03:00 »); null otherwise.
   */
  local: string | null;
}

const shortTime = (locale: string, timeZone: string) =>
  new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone });

const dayKey = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, dateStyle: 'short' }).format(instant);

/**
 * The hours of an event in its own zone, and in the reader's when it differs (FRONT 7, ADR 0151):
 * « 18:00 à Dakar, 19:00 chez vous ». The reader's zone is unknown (`UTC` by default, before the
 * browser told it) only on a first visit: nothing is converted then.
 */
export function eventTimes(
  startsAt: string,
  endsAt: string,
  eventZone: string,
  readerZone: string | null,
  locale: string,
): EventTimes {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: eventZone }).format(
    start,
  );
  const inEvent = shortTime(locale, eventZone).formatRange(start, end);
  let local: string | null = null;
  if (
    readerZone &&
    readerZone !== eventZone &&
    zoneOffsetMinutes(readerZone, start.getTime()) !== zoneOffsetMinutes(eventZone, start.getTime())
  ) {
    const sameDay = dayKey(start, readerZone) === dayKey(start, eventZone);
    local = sameDay
      ? shortTime(locale, readerZone).formatRange(start, end)
      : new Intl.DateTimeFormat(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: readerZone,
        }).formatRange(start, end);
  }
  return { date, time: inEvent, city: zoneCity(eventZone), local };
}
