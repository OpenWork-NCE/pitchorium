import { describe, expect, it } from 'vitest';
import { toggledReaction, withReaction } from './reactions';

const summary = {
  counts: { like: 3, bravo: 1, insightful: 0, support: 0 },
  total: 4,
  viewerReaction: null,
} as const;

describe('optimistic reaction', () => {
  it('adds, changes and takes back the reader reaction', () => {
    const liked = withReaction(summary, 'like');
    expect(liked).toEqual({
      counts: { like: 4, bravo: 1, insightful: 0, support: 0 },
      total: 5,
      viewerReaction: 'like',
    });
    const changed = withReaction(liked, 'support');
    expect(changed).toEqual({
      counts: { like: 3, bravo: 1, insightful: 0, support: 1 },
      total: 5,
      viewerReaction: 'support',
    });
    expect(withReaction(changed, null)).toEqual(summary);
  });

  it('keeps the summary when nothing changes', () => {
    expect(withReaction(summary, null)).toBe(summary);
  });

  it('likes with a click, takes back any reaction with another', () => {
    expect(toggledReaction(null)).toBe('like');
    expect(toggledReaction('bravo')).toBeNull();
  });
});
