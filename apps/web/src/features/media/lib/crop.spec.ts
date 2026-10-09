import { describe, expect, it } from 'vitest';
import { outputSize } from './crop';

describe('outputSize', () => {
  it('keeps a region between the minimum and the largest variant', () => {
    expect(outputSize({ x: 0, y: 0, width: 500, height: 500 }, 'avatar')).toEqual({
      width: 500,
      height: 500,
    });
  });

  it('never sends more than the largest variant', () => {
    expect(outputSize({ x: 0, y: 0, width: 4000, height: 1000 }, 'profile_cover')).toEqual({
      width: 1584,
      height: 396,
    });
  });

  it('brings a small region to the minimum the api accepts, in its ratio', () => {
    expect(outputSize({ x: 10, y: 10, width: 120, height: 120 }, 'avatar')).toEqual({
      width: 200,
      height: 200,
    });
    expect(outputSize({ x: 0, y: 0, width: 800, height: 200 }, 'organization_cover')).toEqual({
      width: 1200,
      height: 300,
    });
  });
});
