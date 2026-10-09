import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import {
  assertFormatFields,
  assertPublicAllowed,
  assertSchedule,
  canTransition,
  countriesOf,
  effectiveVisibility,
  type EventRecord,
  isRegistrationOpen,
} from './event';
import { calendar, escapeText, foldLine, icsDateTime, localDateTime } from './ics';
import { assertCapacity, isFull, placeFor, promotions } from './registrations';

const code = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
};

describe('event lifecycle', () => {
  it('publishes a draft, then cancels or completes it, and stops there', () => {
    expect(canTransition('draft', 'published')).toBe(true);
    expect(canTransition('published', 'canceled')).toBe(true);
    expect(canTransition('published', 'completed')).toBe(true);
    expect(canTransition('draft', 'completed')).toBe(false);
    expect(canTransition('canceled', 'published')).toBe(false);
    expect(canTransition('completed', 'canceled')).toBe(false);
  });

  it('checks the schedule: end after start, bounded duration, not over when published', () => {
    const start = new Date('2026-11-12T17:00:00Z');
    expect(code(() => assertSchedule(start, new Date('2026-11-12T19:00:00Z'), null))).toBeNull();
    expect(code(() => assertSchedule(start, start, null))).toBe('EVENTS_SCHEDULE_INVALID');
    expect(code(() => assertSchedule(start, new Date('2026-12-12T17:00:00Z'), null))).toBe(
      'EVENTS_SCHEDULE_INVALID',
    );
    expect(
      code(() =>
        assertSchedule(start, new Date('2026-11-12T19:00:00Z'), new Date('2026-11-13T00:00:00Z')),
      ),
    ).toBe('EVENTS_SCHEDULE_INVALID');
  });

  it('names the reason of each refusal of the schedule', () => {
    const start = new Date('2026-11-12T17:00:00Z');
    const reason = (run: () => unknown) => {
      try {
        run();
        return null;
      } catch (error) {
        return error instanceof DomainError ? error.details['reason'] : 'unexpected';
      }
    };
    expect(reason(() => assertSchedule(start, start, null))).toBe('ends_before_start');
    expect(reason(() => assertSchedule(start, new Date('2026-12-12T17:00:00Z'), null))).toBe(
      'too_long',
    );
    expect(
      reason(() =>
        assertSchedule(start, new Date('2026-11-12T19:00:00Z'), new Date('2026-11-13T00:00:00Z')),
      ),
    ).toBe('already_over');
  });

  it('requires a place in person, a link online, both when hybrid', () => {
    const place = { name: 'Impact Hub', address: null, city: 'Dakar', countryCode: 'SN' };
    expect(code(() => assertFormatFields('in_person', place, null))).toBeNull();
    expect(code(() => assertFormatFields('in_person', null, null))).toBe(
      'EVENTS_LOCATION_REQUIRED',
    );
    expect(code(() => assertFormatFields('online', null, null))).toBe('EVENTS_ONLINE_URL_REQUIRED');
    expect(code(() => assertFormatFields('hybrid', place, null))).toBe(
      'EVENTS_ONLINE_URL_REQUIRED',
    );
    expect(
      code(() => assertFormatFields('hybrid', place, 'https://meet.example.org/a')),
    ).toBeNull();
    expect(countriesOf(place, ['CI', 'SN'])).toEqual(['SN', 'CI']);
  });

  it('keeps an event public only with a public organizer, as publications', () => {
    expect(effectiveVisibility('public', true)).toBe('public');
    expect(effectiveVisibility('public', false)).toBe('members');
    expect(code(() => assertPublicAllowed('public', false))).toBe('EVENTS_PUBLIC_NOT_ALLOWED');
    expect(code(() => assertPublicAllowed('members', false))).toBeNull();
  });

  it('opens registrations from publication to the start', () => {
    const event = {
      status: 'published',
      moderationStatus: 'visible',
      startsAt: new Date('2026-11-12T17:00:00Z'),
    } as EventRecord;
    expect(isRegistrationOpen(event, new Date('2026-11-12T16:59:00Z'))).toBe(true);
    expect(isRegistrationOpen(event, new Date('2026-11-12T17:00:00Z'))).toBe(false);
    expect(isRegistrationOpen({ ...event, status: 'draft' }, new Date('2026-11-01'))).toBe(false);
    expect(
      isRegistrationOpen({ ...event, moderationStatus: 'hidden' }, new Date('2026-11-01')),
    ).toBe(false);
  });
});

describe('waiting list', () => {
  it('gives a seat while there is one, then the waiting list', () => {
    expect(placeFor(2, 0)).toBe('registered');
    expect(placeFor(2, 1)).toBe('registered');
    expect(placeFor(2, 2)).toBe('waitlisted');
    expect(placeFor(null, 10_000)).toBe('registered');
    expect(isFull(2, 2)).toBe(true);
    expect(isFull(null, 2)).toBe(false);
  });

  it('promotes the waiting list in order, for the free seats only', () => {
    expect(promotions(3, 2, ['a', 'b', 'c'])).toEqual(['a']);
    expect(promotions(5, 2, ['a', 'b'])).toEqual(['a', 'b']);
    expect(promotions(2, 2, ['a'])).toEqual([]);
    expect(promotions(null, 2, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('never lowers the capacity below the registered members', () => {
    expect(code(() => assertCapacity(3, 4))).toBe('EVENTS_CAPACITY_BELOW_REGISTERED');
    expect(code(() => assertCapacity(4, 4))).toBeNull();
    expect(code(() => assertCapacity(null, 4))).toBeNull();
  });
});

describe('time zones', () => {
  it('stores instants given with an offset in UTC and shows them in the zone of the place', () => {
    // 18:00 in Paris in November (UTC+1), 12:00 in Port-au-Prince (UTC-5).
    const start = new Date('2026-11-12T18:00:00+01:00');
    expect(start.toISOString()).toBe('2026-11-12T17:00:00.000Z');
    expect(localDateTime(start, 'Europe/Paris')).toBe('2026-11-12 18:00 (Europe/Paris)');
    expect(localDateTime(start, 'Africa/Dakar')).toBe('2026-11-12 17:00 (Africa/Dakar)');
    expect(localDateTime(start, 'America/Port-au-Prince')).toBe(
      '2026-11-12 12:00 (America/Port-au-Prince)',
    );
  });

  it('follows the summer time of the zone', () => {
    // The same wall time in Paris is UTC+2 in July, UTC+1 in January.
    expect(localDateTime(new Date('2026-07-01T16:00:00Z'), 'Europe/Paris')).toContain('18:00');
    expect(localDateTime(new Date('2026-01-15T17:00:00Z'), 'Europe/Paris')).toContain('18:00');
  });
});

describe('iCalendar export (RFC 5545)', () => {
  const event = {
    uid: '0192f0a0-0000-7000-8000-000000000001@pitchorium',
    sequence: 2,
    title: 'Atelier : financer, mentorer; réussir',
    description: 'Première ligne\nSeconde ligne',
    startsAt: new Date('2026-11-12T17:00:00Z'),
    endsAt: new Date('2026-11-12T19:00:00Z'),
    timeZone: 'Africa/Dakar',
    location: 'Impact Hub, Dakar',
    url: 'https://app.pitchorium.test/events/atelier',
    canceled: false,
    updatedAt: new Date('2026-10-08T10:00:00Z'),
  };

  it('writes UTC instants, escapes text and ends lines with CRLF', () => {
    const ics = calendar('Pitchorium', [event], new Date('2026-10-08T12:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261112T170000Z\r\n');
    expect(ics).toContain('DTEND:20261112T190000Z\r\n');
    expect(ics).toContain('DTSTAMP:20261008T120000Z\r\n');
    expect(ics).toContain('SEQUENCE:2\r\n');
    expect(ics).toContain('SUMMARY:Atelier : financer\\, mentorer\\; réussir\r\n');
    expect(ics).toContain('LOCATION:Impact Hub\\, Dakar\r\n');
    expect(ics).toContain('STATUS:CONFIRMED');
    // The local time of the place opens the description.
    expect(ics).toContain('2026-11-12 17:00 (Africa/Dakar)');
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    );
  });

  it('marks a canceled event so that calendars drop it', () => {
    const ics = calendar('Pitchorium', [{ ...event, canceled: true }], new Date());
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it('folds long lines at 75 octets without cutting a character', () => {
    const line = `DESCRIPTION:${'é'.repeat(80)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n ');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => new TextEncoder().encode(part).length <= 75)).toBe(true);
    expect(parts.join('')).toBe(line);
  });

  it('escapes the TEXT special characters', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
    expect(icsDateTime(new Date('2026-01-02T03:04:05.678Z'))).toBe('20260102T030405Z');
  });
});
