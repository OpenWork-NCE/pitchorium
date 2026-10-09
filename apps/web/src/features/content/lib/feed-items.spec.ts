import { describe, expect, it, vi } from 'vitest';
import { drawnItems, newItems } from './feed-items';

describe('items of the feed', () => {
  it('draws the known types, leaves the events for later and reports an unknown type', () => {
    const report = vi.fn();
    const items = [
      { type: 'post', id: 'post:1' },
      { type: 'event', id: 'event:2' },
      { type: 'hologram', id: 'hologram:3' },
      { type: 'featured', id: 'featured:4' },
      { type: 'project_update', id: 'project_update:5' },
      { type: 'suggestion', id: 'suggestion:6' },
      { type: 'repost', id: 'repost:7' },
    ];
    expect(drawnItems(items, report).map((item) => item.id)).toEqual([
      'post:1',
      'featured:4',
      'project_update:5',
      'suggestion:6',
      'repost:7',
    ]);
    expect(report).toHaveBeenCalledExactlyOnceWith('hologram');
  });

  it('finds the items newer than the first one shown', () => {
    const known = [{ id: 'c' }, { id: 'd' }];
    expect(newItems([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], known)).toEqual([
      { id: 'a' },
      { id: 'b' },
    ]);
    expect(newItems(known, known)).toEqual([]);
  });
});
