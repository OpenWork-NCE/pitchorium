import * as contracts from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import * as limits from './limits';

describe('limits copied from the contracts', () => {
  it('stay equal to the contracts', () => {
    expect(limits.MISSION_TITLE_MAX_LENGTH).toBe(contracts.MISSION_TITLE_MAX_LENGTH);
    expect(limits.MISSION_DESCRIPTION_MAX_LENGTH).toBe(contracts.MISSION_DESCRIPTION_MAX_LENGTH);
    expect(limits.MISSION_DOMAIN_MAX_LENGTH).toBe(contracts.MISSION_DOMAIN_MAX_LENGTH);
    expect(limits.MISSION_MESSAGE_MAX_LENGTH).toBe(contracts.MISSION_MESSAGE_MAX_LENGTH);
    expect(limits.MISSION_SKILLS_MAX).toBe(contracts.MISSION_SKILLS_MAX);
    expect(limits.MISSION_SECTORS_MAX).toBe(contracts.MISSION_SECTORS_MAX);
    expect(limits.MISSION_COUNTRIES_MAX).toBe(contracts.MISSION_COUNTRIES_MAX);
    expect(limits.MISSION_LANGUAGES_MAX).toBe(contracts.MISSION_LANGUAGES_MAX);
    expect(limits.MISSION_CAPACITY_MAX).toBe(contracts.MISSION_CAPACITY_MAX);
    expect(limits.MISSION_MAX_HOURS).toEqual(contracts.MISSION_MAX_HOURS);
    expect(limits.MISSION_DIRECTIONS).toEqual(contracts.MISSION_DIRECTIONS);
    expect(limits.MISSION_FORMATS).toEqual(contracts.MISSION_FORMATS);
    expect(limits.MISSION_MODES).toEqual(contracts.MISSION_MODES);
    expect(limits.MISSION_KINDS).toEqual(contracts.TIME_ENTRY_KINDS);
  });
});
