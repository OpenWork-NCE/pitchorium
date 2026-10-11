import { describe, expect, it } from 'vitest';
import { captureAnchor, isAtEnd, type PlacedRow, restoreAnchor } from './anchor';

/** Rows of the given sizes, one after the other. */
function place(rows: readonly [string, number][]): PlacedRow[] {
  let start = 0;
  return rows.map(([key, size]) => {
    const row = { key, start, size };
    start += size;
    return row;
  });
}

describe('anchoring of the history', () => {
  it('keeps the first row seen at its place when older messages arrive above', () => {
    const before = place([
      ['d:2026-10-09', 32],
      ['m:a', 60],
      ['m:b', 80],
    ]);
    // The view starts 10 px inside the message a.
    const anchor = captureAnchor(before, 42);
    expect(anchor).toEqual({ key: 'm:a', offset: -10 });
    const after = place([
      ['d:2026-10-08', 32],
      ['m:older-1', 120],
      ['m:older-2', 44],
      ['d:2026-10-09', 32],
      ['m:a', 60],
      ['m:b', 80],
    ]);
    // The message a now starts at 228: the view moves by the 196 px added, nothing jumps.
    expect(restoreAnchor(anchor, after, 42)).toBe(238);
  });

  it('keeps the position when the anchor left, and when the list was empty', () => {
    expect(restoreAnchor({ key: 'm:gone', offset: 0 }, place([['m:x', 10]]), 15)).toBe(15);
    expect(restoreAnchor(captureAnchor([], 0), place([['m:x', 10]]), 0)).toBe(0);
  });

  it('says when the view shows the end, to follow a new message', () => {
    expect(isAtEnd(552, 400, 1_000)).toBe(true);
    expect(isAtEnd(300, 400, 1_000)).toBe(false);
  });
});
