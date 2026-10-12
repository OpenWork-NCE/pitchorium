import * as contracts from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { IMPACT_CRITERIA_MAX, IMPACT_SCALE_LEVELS_MAX } from './limits';

describe('impact limits', () => {
  it('match the contracts', () => {
    expect(IMPACT_CRITERIA_MAX).toBe(contracts.IMPACT_CRITERIA_MAX);
    expect(IMPACT_SCALE_LEVELS_MAX).toBe(contracts.IMPACT_SCALE_LEVELS_MAX);
  });
});
