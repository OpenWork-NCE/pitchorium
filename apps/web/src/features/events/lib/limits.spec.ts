import * as contracts from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import * as limits from './limits';

describe('limits copied from the contracts', () => {
  it('stay equal to the contracts', () => {
    expect(limits.EVENT_TITLE_MAX_LENGTH).toBe(contracts.EVENT_TITLE_MAX_LENGTH);
    expect(limits.EVENT_DESCRIPTION_MAX_LENGTH).toBe(contracts.EVENT_DESCRIPTION_MAX_LENGTH);
    expect(limits.EVENT_LOCATION_MAX_LENGTH).toBe(contracts.EVENT_LOCATION_MAX_LENGTH);
    expect(limits.EVENT_IMAGE_ALT_MAX_LENGTH).toBe(contracts.EVENT_IMAGE_ALT_MAX_LENGTH);
    expect(limits.EVENT_SECTORS_MAX).toBe(contracts.EVENT_SECTORS_MAX);
    expect(limits.EVENT_CAPACITY_MAX).toBe(contracts.EVENT_CAPACITY_MAX);
    expect(limits.EVENT_FORMATS).toEqual(contracts.EVENT_FORMATS);
  });
});
