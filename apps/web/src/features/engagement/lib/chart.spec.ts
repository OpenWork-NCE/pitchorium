import { describe, expect, it } from 'vitest';
import { hoursAndMinutes, monthlyValues } from './chart';

const month = (key: string, amountMinor: string) => ({
  month: key,
  given: { amountMinor, currency: 'EUR' },
});

describe('monthlyValues', () => {
  it('keeps the amounts of the api in minor units, a refunded month below zero', () => {
    expect(
      monthlyValues([month('2026-08', '0'), month('2026-09', '-500'), month('2026-10', '240000')]),
    ).toEqual([0, -500, 240_000]);
  });
});

describe('hoursAndMinutes', () => {
  it('splits minutes into whole hours and minutes', () => {
    expect(hoursAndMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(hoursAndMinutes(45)).toEqual({ hours: 0, minutes: 45 });
    expect(hoursAndMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
});
