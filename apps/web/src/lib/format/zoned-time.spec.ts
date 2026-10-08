import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  formatOffset,
  instantToWallTime,
  wallTimeToInstant,
  weekStartOf,
  zoneCity,
  zoneOffsetMinutes,
} from './zoned-time';

const wall = (date: string, time: string) => {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
};

describe('zoned time', () => {
  it('turns a wall time of a zone into its instant, in summer and in winter', () => {
    expect(wallTimeToInstant(wall('2026-07-14', '18:00'), 'Europe/Paris')).toBe(
      '2026-07-14T16:00:00.000Z',
    );
    expect(wallTimeToInstant(wall('2026-12-01', '18:00'), 'Europe/Paris')).toBe(
      '2026-12-01T17:00:00.000Z',
    );
    expect(wallTimeToInstant(wall('2026-12-01', '18:00'), 'Africa/Dakar')).toBe(
      '2026-12-01T18:00:00.000Z',
    );
    expect(wallTimeToInstant(wall('2026-03-10', '09:30'), 'America/Martinique')).toBe(
      '2026-03-10T13:30:00.000Z',
    );
  });

  it('moves a time skipped by summer time forward, takes the first of a repeated one', () => {
    // 29 March 2026 in Paris: 02:30 does not exist.
    expect(wallTimeToInstant(wall('2026-03-29', '02:30'), 'Europe/Paris')).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    // 25 October 2026 in Paris: 02:30 happens twice.
    expect(wallTimeToInstant(wall('2026-10-25', '02:30'), 'Europe/Paris')).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('brings a day past the end of its month back to the last day', () => {
    expect(wallTimeToInstant(wall('2027-02-31', '10:00'), 'UTC')).toBe('2027-02-28T10:00:00.000Z');
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it('reads an instant back as the wall time of a zone', () => {
    expect(instantToWallTime('2026-07-14T16:00:00.000Z', 'Europe/Paris')).toEqual(
      wall('2026-07-14', '18:00'),
    );
    expect(instantToWallTime('2026-07-14T23:30:00.000Z', 'Africa/Lagos')).toEqual(
      wall('2026-07-15', '00:30'),
    );
  });

  it('knows the offset, the city and the first day of the week', () => {
    expect(zoneOffsetMinutes('Europe/Paris', Date.parse('2026-07-14T12:00:00Z'))).toBe(120);
    expect(formatOffset(0)).toBe('+0');
    expect(formatOffset(-240)).toBe('-4');
    expect(formatOffset(330)).toBe('+5:30');
    expect(zoneCity('America/Port-au-Prince')).toBe('Port-au-Prince');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(weekStartOf('fr')).toBe(1);
    expect(weekStartOf('en-US')).toBe(0);
  });
});
