import { describe, expect, it } from 'vitest';
import { missionsApiQuery, myEngagementsQuery, readMissionFilters } from './missions-query';

describe('filters of the missions', () => {
  it('maps the filters of the address to the list of the api', () => {
    const filters = readMissionFilters(
      { direction: 'offer', kind: 'mentoring', mode: 'remote', country: 'SN', language: 'fr' },
      false,
    );
    expect(missionsApiQuery(filters)).toEqual({
      limit: 12,
      direction: 'offer',
      kind: 'mentoring',
      mode: 'remote',
      countryCode: 'SN',
      language: 'fr',
    });
  });

  it('keeps the views of a member to a member, and reads the role of an engagement', () => {
    expect(readMissionFilters({ tab: 'engagements' }, false).tab).toBe('all');
    const mine = readMissionFilters({ tab: 'engagements', role: 'expert' }, true);
    expect(myEngagementsQuery(mine, 'c')).toEqual({ limit: 12, role: 'expert', cursor: 'c' });
    expect(readMissionFilters({ direction: 'job', mode: 'office' }, true)).toMatchObject({
      direction: null,
      mode: null,
    });
  });
});
