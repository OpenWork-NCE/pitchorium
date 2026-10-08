import { describe, expect, it } from 'vitest';
import { instantToWallTime, wallTimeToInstant, zoneLabel, zoneOffset } from './zoned-time';

describe('zoned time', () => {
  it('turns a wall time of a zone into its instant, in summer and in winter', () => {
    expect(wallTimeToInstant({ date: '2026-07-14', time: '18:00' }, 'Europe/Paris')).toBe(
      '2026-07-14T16:00:00.000Z',
    );
    expect(wallTimeToInstant({ date: '2026-12-01', time: '18:00' }, 'Europe/Paris')).toBe(
      '2026-12-01T17:00:00.000Z',
    );
    expect(wallTimeToInstant({ date: '2026-12-01', time: '18:00' }, 'Africa/Dakar')).toBe(
      '2026-12-01T18:00:00.000Z',
    );
    expect(wallTimeToInstant({ date: '2026-03-10', time: '09:30' }, 'America/Martinique')).toBe(
      '2026-03-10T13:30:00.000Z',
    );
  });

  it('moves a time skipped by summer time forward, takes the first of a repeated one', () => {
    // 29 March 2026 in Paris: 02:30 does not exist.
    expect(wallTimeToInstant({ date: '2026-03-29', time: '02:30' }, 'Europe/Paris')).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    // 25 October 2026 in Paris: 02:30 happens twice.
    expect(wallTimeToInstant({ date: '2026-10-25', time: '02:30' }, 'Europe/Paris')).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('reads an instant back as the wall time of a zone', () => {
    expect(instantToWallTime('2026-07-14T16:00:00.000Z', 'Europe/Paris')).toEqual({
      date: '2026-07-14',
      time: '18:00',
    });
    expect(instantToWallTime('2026-07-14T23:30:00.000Z', 'Africa/Lagos')).toEqual({
      date: '2026-07-15',
      time: '00:30',
    });
  });

  it('knows the offset and names the zone', () => {
    expect(zoneOffset(Date.parse('2026-07-14T12:00:00Z'), 'Europe/Paris')).toBe(2 * 3600_000);
    expect(zoneLabel('Africa/Dakar', 'en', Date.parse('2026-07-14T12:00:00Z'))).toBe(
      'Greenwich Mean Time, UTC+0',
    );
  });
});
