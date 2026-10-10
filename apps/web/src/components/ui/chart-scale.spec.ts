import { describe, expect, it } from 'vitest';
import { barHeights, chartTicks, isEmptySeries, peakIndex } from './chart-scale';

describe('chartTicks', () => {
  it('graduates to the first round value at or above the largest one', () => {
    expect(chartTicks(240_000)).toEqual([0, 100_000, 200_000, 300_000]);
    expect(chartTicks(312)).toEqual([0, 100, 200, 300, 400]);
    expect(chartTicks(7)).toEqual([0, 2, 4, 6, 8]);
  });

  it('never steps below one: a count of three has whole graduations', () => {
    expect(chartTicks(3)).toEqual([0, 1, 2, 3]);
    expect(chartTicks(1)).toEqual([0, 1]);
  });

  it('keeps whole graduations for any largest value', () => {
    for (const max of [1, 9, 17, 99, 101, 4_999, 123_456, 9_999_999]) {
      const ticks = chartTicks(max);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });

  it('has a single graduation for nothing', () => {
    expect(chartTicks(0)).toEqual([0]);
    expect(chartTicks(-50)).toEqual([0]);
  });
});

describe('barHeights', () => {
  it('scales to the top graduation and keeps a small value visible', () => {
    expect(barHeights([0, 50, 300_000, 1_000], 300_000)).toEqual([0, 2, 100, 2]);
    expect(barHeights([150], 300)).toEqual([50]);
  });

  it('draws a negative value as empty', () => {
    expect(barHeights([-10, 10], 10)).toEqual([0, 100]);
  });
});

describe('peakIndex and isEmptySeries', () => {
  it('finds the first largest value', () => {
    expect(peakIndex([0, 5, 9, 9, 1])).toBe(2);
  });

  it('says a series of zeros, negatives or nothing is empty', () => {
    expect(isEmptySeries([])).toBe(true);
    expect(isEmptySeries([0, 0, -3])).toBe(true);
    expect(isEmptySeries([0, 1])).toBe(false);
  });
});
