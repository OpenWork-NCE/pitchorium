import { describe, expect, it } from 'vitest';
import { lockedFields } from './locked';

describe('fields locked on a campaign', () => {
  it('leaves everything editable on a draft', () => {
    expect(lockedFields('draft', false)).toEqual({
      goal: null,
      tierThresholds: null,
      rewardMinimums: null,
      duration: null,
    });
  });

  it('locks the duration at the publication, the amounts at the first contribution', () => {
    expect(lockedFields('funding', false)).toEqual({
      goal: null,
      tierThresholds: null,
      rewardMinimums: null,
      duration: 'published',
    });
    expect(lockedFields('funded', true)).toEqual({
      goal: 'contribution',
      tierThresholds: 'contribution',
      rewardMinimums: 'contribution',
      duration: 'published',
    });
  });
});
