import { describe, expect, it } from 'vitest';
import { chunk, interleave } from './interleave';

const shape = (entries: ReturnType<typeof interleave<number, string>>) =>
  entries.map((entry) => (entry.kind === 'item' ? String(entry.value) : entry.value)).join(' ');

describe('interleave', () => {
  it('puts the first module after the first items, then one every few items', () => {
    const items = Array.from({ length: 14 }, (_, index) => index + 1);
    expect(shape(interleave(items, ['A', 'B', 'C'], { first: 3, every: 10 }))).toBe(
      '1 2 3 A 4 5 6 7 8 9 10 11 12 13 B 14',
    );
  });

  it('closes a short list with one module, and stops when modules run out', () => {
    expect(shape(interleave([1], ['A', 'B'], { first: 3, every: 10 }))).toBe('1 A');
    expect(shape(interleave([], ['A'], { first: 3, every: 10 }))).toBe('A');
    expect(shape(interleave([1, 2, 3, 4], [], { first: 3, every: 10 }))).toBe('1 2 3 4');
  });

  it('goes on counting on the next page of the list', () => {
    expect(shape(interleave([14, 15, 16, 17], ['B'], { first: 3, every: 10 }, 13))).toBe(
      '14 15 16 17',
    );
    expect(shape(interleave([11, 12, 13, 14], ['B'], { first: 3, every: 10 }, 10))).toBe(
      '11 12 13 B 14',
    );
  });

  it('slices values', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});
