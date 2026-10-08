import { describe, expect, it } from 'vitest';
import {
  dateTimeLayout,
  dayPeriods,
  EMPTY,
  eraseDigit,
  segmentRange,
  segmentValue,
  stepSegment,
  toWallDateTime,
  typeDigit,
  withSegment,
} from './date-segments';

const REFERENCE = { year: 2026, month: 10, day: 8, hour: 14, minute: 37 };
const order = (locale: string) =>
  dateTimeLayout(locale)
    .items.filter((item) => item.type !== 'literal')
    .map((item) => item.type);

describe('date segments', () => {
  it('follows the locale of the application: day first and 24 hours in French', () => {
    expect(order('fr')).toEqual(['day', 'month', 'year', 'hour', 'minute']);
    expect(dateTimeLayout('fr').hour12).toBe(false);
    expect(order('en')).toEqual(['month', 'day', 'year', 'hour', 'minute', 'dayPeriod']);
    expect(dateTimeLayout('en').hour12).toBe(true);
    expect(dayPeriods('en')).toEqual(['AM', 'PM']);
  });

  it('types two digits, or moves on when no other digit could follow', () => {
    let step = typeDigit(EMPTY, 'day', '', '2', false);
    expect(step).toMatchObject({ typed: '2', advance: false });
    step = typeDigit(step.parts, 'day', step.typed, '5', false);
    expect(step).toMatchObject({ typed: '', advance: true });
    expect(step.parts.day).toBe(25);
    // 4 cannot start a two-digit day: it is the day.
    expect(typeDigit(EMPTY, 'day', '', '4', false)).toMatchObject({ advance: true });
    // A number past the bounds starts over with the digit.
    expect(typeDigit({ ...EMPTY, month: 1 }, 'month', '1', '5', false).parts.month).toBe(5);
    // Zero alone is not a day yet.
    expect(typeDigit(EMPTY, 'day', '', '0', false).parts.day).toBeNull();
  });

  it('types a year on four digits', () => {
    let parts = EMPTY;
    let typed = '';
    for (const digit of '2026') {
      const step = typeDigit(parts, 'year', typed, digit, false);
      parts = step.parts;
      typed = step.typed;
    }
    expect(parts.year).toBe(2026);
    expect(typed).toBe('');
  });

  it('cycles with the arrows and starts an empty segment from the reference', () => {
    expect(stepSegment(EMPTY, 'month', 1, false, REFERENCE).month).toBe(10);
    expect(stepSegment({ ...EMPTY, month: 12 }, 'month', 1, false, REFERENCE).month).toBe(1);
    expect(stepSegment({ ...EMPTY, minute: 0 }, 'minute', -1, false, REFERENCE).minute).toBe(59);
    expect(stepSegment(EMPTY, 'minute', 1, false, REFERENCE).minute).toBe(0);
  });

  it('bounds the day by the month and the year typed', () => {
    expect(segmentRange('day', { ...EMPTY, year: 2027, month: 2 }, false).max).toBe(28);
    expect(segmentRange('day', { ...EMPTY, month: 2 }, false).max).toBe(29);
    expect(segmentRange('day', EMPTY, false).max).toBe(31);
  });

  it('keeps the hour on 24 hours behind a 12-hour clock', () => {
    const evening = withSegment(withSegment(EMPTY, 'dayPeriod', 1, true), 'hour', 6, true);
    expect(evening.hour).toBe(18);
    expect(segmentValue('hour', evening, true)).toBe(6);
    expect(withSegment(evening, 'dayPeriod', 0, true).hour).toBe(6);
    expect(segmentValue('hour', { ...EMPTY, hour: 0 }, true)).toBe(12);
    expect(stepSegment({ ...EMPTY, hour: 23 }, 'hour', 1, false, REFERENCE).hour).toBe(0);
  });

  it('erases the last digit, then the value', () => {
    const first = eraseDigit({ ...EMPTY, day: 25 }, 'day', '', false);
    expect(first).toEqual({ parts: { ...EMPTY, day: 2 }, typed: '2' });
    expect(eraseDigit(first.parts, 'day', first.typed, false).parts.day).toBeNull();
  });

  it('is complete once every part is typed', () => {
    expect(toWallDateTime({ ...REFERENCE, pm: null })).toEqual(REFERENCE);
    expect(toWallDateTime({ ...REFERENCE, minute: null, pm: null })).toBeNull();
  });
});
