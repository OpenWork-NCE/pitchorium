import { describe, expect, it } from 'vitest';
import { chartBars, hoursAndMinutes } from './chart';

const month = (key: string, amountMinor: string) => ({
  month: key,
  given: { amountMinor, currency: 'EUR' },
});

describe('chartBars', () => {
  it('scales each month to the tallest one in integers, keeping the amounts of the api', () => {
    const bars = chartBars([
      month('2026-08', '0'),
      month('2026-09', '2500'),
      month('2026-10', '10000'),
    ]);
    expect(bars.map((bar) => bar.height)).toEqual([0, 25, 100]);
    expect(bars[1]!.given).toEqual({ amountMinor: '2500', currency: 'EUR' });
  });

  it('draws nothing for a year without money, and an empty bar for a negative month', () => {
    expect(
      chartBars([month('2026-09', '0'), month('2026-10', '0')]).every((bar) => bar.height === 0),
    ).toBe(true);
    expect(
      chartBars([month('2026-09', '-500'), month('2026-10', '1000')]).map((bar) => bar.height),
    ).toEqual([0, 100]);
  });

  it('keeps a small month visible next to a large one', () => {
    expect(
      chartBars([month('2026-09', '2200000'), month('2026-10', '4000')]).map((bar) => bar.height),
    ).toEqual([100, 2]);
  });

  it('stays exact beyond the integers a float holds', () => {
    const bars = chartBars([
      month('2026-09', '9007199254740993'),
      month('2026-10', '18014398509481986'),
    ]);
    expect(bars.map((bar) => bar.height)).toEqual([50, 100]);
  });
});

describe('hoursAndMinutes', () => {
  it('splits minutes into whole hours and minutes', () => {
    expect(hoursAndMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(hoursAndMinutes(45)).toEqual({ hours: 0, minutes: 45 });
    expect(hoursAndMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
});
