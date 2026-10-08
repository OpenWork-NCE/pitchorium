import { describe, expect, it } from 'vitest';
import { NOTIFICATION_DEFINITIONS } from '../domain/notification-types';
import { SOURCE_EVENT_TYPES } from './notification-sources';

describe('notification sources', () => {
  it('listens to every source event of the registry', () => {
    const events = Object.values(NOTIFICATION_DEFINITIONS)
      .flatMap((definition) => definition.sources)
      .filter((source) => /\.v\d+$/.test(source));
    expect(events.filter((source) => !SOURCE_EVENT_TYPES.includes(source))).toEqual([]);
  });
});
