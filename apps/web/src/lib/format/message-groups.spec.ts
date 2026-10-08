import { describe, expect, it } from 'vitest';
import { dayOf, daysBetween, groupMessages } from './message-groups';

const message = (author: string, createdAt: string) => ({ author, createdAt });

describe('message groups', () => {
  it('splits by day in the time zone of the reader', () => {
    // 22:30 in UTC is the next day in Paris already, still the same day in Dakar.
    expect(dayOf('2026-10-07T22:30:00Z', 'Europe/Paris')).toBe('2026-10-08');
    expect(dayOf('2026-10-07T22:30:00Z', 'Africa/Dakar')).toBe('2026-10-07');
    const days = groupMessages(
      [message('kofi', '2026-10-07T21:00:00Z'), message('kofi', '2026-10-07T22:30:00Z')],
      'Europe/Paris',
    );
    expect(days.map((day) => day.day)).toEqual(['2026-10-07', '2026-10-08']);
  });

  it('groups the consecutive messages of one author written close together', () => {
    const [day] = groupMessages(
      [
        message('kofi', '2026-10-08T09:00:00Z'),
        message('kofi', '2026-10-08T09:04:00Z'),
        message('me', '2026-10-08T09:05:00Z'),
        message('me', '2026-10-08T09:06:00Z'),
        // Ten minutes later: a new group of the same author.
        message('me', '2026-10-08T09:16:00Z'),
      ],
      'UTC',
    );
    expect(day?.groups.map((group) => [group.author, group.messages.length])).toEqual([
      ['kofi', 2],
      ['me', 2],
      ['me', 1],
    ]);
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-10-08', '2026-10-08')).toBe(0);
    expect(daysBetween('2026-10-07', '2026-10-08')).toBe(1);
    expect(daysBetween('2026-09-30', '2026-10-08')).toBe(8);
  });
});
