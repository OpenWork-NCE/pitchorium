import { describe, expect, it } from 'vitest';
import { lastMonths } from './time-entry';

describe('lastMonths', () => {
  it('lists the months ending with the current one, oldest first, in UTC', () => {
    expect(lastMonths(new Date('2026-03-31T23:30:00Z'), 4)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('takes the month of the instant in UTC, not in the local time of the server', () => {
    expect(lastMonths(new Date('2026-01-01T00:00:00Z'), 1)).toEqual(['2026-01']);
  });
});
