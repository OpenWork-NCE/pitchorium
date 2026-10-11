import {
  DISCOVER_SECTIONS,
  DISCOVERY_KINDS,
  EVENT_FORMATS,
  MISSION_DIRECTIONS,
  MISSION_MODES,
  publicProjectStatusSchema,
  TIME_ENTRY_KINDS,
} from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import * as kinds from './kinds';

describe('values copied from the contracts', () => {
  it('stay equal to the contracts', () => {
    expect(kinds.DISCOVERY_KINDS).toEqual(DISCOVERY_KINDS);
    expect(kinds.DISCOVER_SECTIONS).toEqual(DISCOVER_SECTIONS);
    expect(kinds.PROJECT_STATUSES).toEqual(publicProjectStatusSchema.options);
    expect(kinds.EVENT_FORMATS).toEqual(EVENT_FORMATS);
    expect(kinds.MISSION_DIRECTIONS).toEqual(MISSION_DIRECTIONS);
    expect(kinds.MISSION_KINDS).toEqual(TIME_ENTRY_KINDS);
    expect(kinds.MISSION_MODES).toEqual(MISSION_MODES);
  });
});
