import { TIME_ENTRY_DESCRIPTION_MAX_LENGTH, TIME_ENTRY_MAX_MINUTES } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { TIME_LIMITS } from './limits';

describe('TIME_LIMITS', () => {
  it('equals the limits of the contracts', () => {
    expect(TIME_LIMITS).toEqual({
      description: TIME_ENTRY_DESCRIPTION_MAX_LENGTH,
      maxMinutes: TIME_ENTRY_MAX_MINUTES,
    });
  });
});
