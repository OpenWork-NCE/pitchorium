import type { Message } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { threadRows } from './thread-rows';

const message = (id: number, createdAt: string): Message =>
  ({
    id: `m${id}`,
    clientMessageId: `c${id}`,
    createdAt,
    mine: false,
    senderHandle: 'kofi-mensah',
  }) as Message;

describe('rows of a thread', () => {
  it('puts a separator before each day, then the messages of the day', () => {
    const rows = threadRows(
      [message(1, '2026-10-10T09:00:00Z'), message(2, '2026-10-11T09:00:00Z')],
      [],
      'UTC',
    );
    expect(rows.map((row) => row.key)).toEqual(['d:2026-10-10', 'm:c1', 'd:2026-10-11', 'm:c2']);
  });

  it('gives a day that comes back after another one a key of its own', () => {
    // The order of the api (sequence) with an instant out of that order.
    const rows = threadRows(
      [
        message(1, '2026-10-11T09:00:00Z'),
        message(2, '2026-10-10T09:00:00Z'),
        message(3, '2026-10-11T10:00:00Z'),
      ],
      [],
      'UTC',
    );
    const keys = rows.map((row) => row.key);
    expect(keys).toEqual([
      'd:2026-10-11',
      'm:c1',
      'd:2026-10-10',
      'm:c2',
      'd:2026-10-11:2',
      'm:c3',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
