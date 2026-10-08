import { DateFormatter } from '@internationalized/date';
import { daysInMonth, type WallDateTime } from './zoned-time';

/**
 * Segments of a date and time typed part by part (DateTimeField, ADR 0100): their order, their
 * separators and the hour cycle come from the locale of the application, never from the
 * browser; the arithmetic stays on whole numbers.
 */
export type SegmentType = 'day' | 'month' | 'year' | 'hour' | 'minute' | 'dayPeriod';

export type LayoutItem = { type: SegmentType } | { type: 'literal'; text: string };

export interface DateTimeLayout {
  items: readonly LayoutItem[];
  /** 12-hour clock with a day period (English), 24-hour otherwise (French). */
  hour12: boolean;
}

/** A date and time being typed: each part may still be missing. */
export interface PartialDateTime {
  year: number | null;
  month: number | null;
  day: number | null;
  /** 0 to 23, whatever the clock shown. */
  hour: number | null;
  minute: number | null;
  /** Afternoon chosen before the hour, on a 12-hour clock. */
  pm: boolean | null;
}

export const EMPTY: PartialDateTime = {
  year: null,
  month: null,
  day: null,
  hour: null,
  minute: null,
  pm: null,
};

const SEGMENT_TYPES = new Set<string>(['day', 'month', 'year', 'hour', 'minute', 'dayPeriod']);
const layouts = new Map<string, DateTimeLayout>();

/** Order, separators and clock of the locale (`fr`: 20/11/2026 18:05, `en`: 11/20/2026, 6:05 PM). */
export function dateTimeLayout(locale: string): DateTimeLayout {
  const cached = layouts.get(locale);
  if (cached) return cached;
  const formatter = new DateFormatter(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const items: LayoutItem[] = formatter
    .formatToParts(new Date(Date.UTC(2026, 10, 20, 18, 5)))
    .flatMap((part): LayoutItem[] => {
      if (SEGMENT_TYPES.has(part.type)) return [{ type: part.type as SegmentType }];
      if (part.type === 'literal') return [{ type: 'literal', text: part.value }];
      return [];
    });
  const cycle = formatter.resolvedOptions().hourCycle ?? 'h23';
  const layout = { items, hour12: cycle === 'h11' || cycle === 'h12' };
  layouts.set(locale, layout);
  return layout;
}

/** Names of the two day periods in the locale (`AM`, `PM`). */
export function dayPeriods(locale: string): [string, string] {
  const formatter = new DateFormatter(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const period = (hour: number) =>
    formatter
      .formatToParts(new Date(Date.UTC(2026, 0, 1, hour)))
      .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  return [period(9), period(21)];
}

function isPm(parts: PartialDateTime): boolean | null {
  return parts.hour === null ? parts.pm : parts.hour >= 12;
}

/** Bounds of a segment: the days of the month typed (31 while it is unknown). */
export function segmentRange(
  type: SegmentType,
  parts: PartialDateTime,
  hour12: boolean,
): { min: number; max: number } {
  switch (type) {
    case 'year':
      return { min: 1, max: 9999 };
    case 'month':
      return { min: 1, max: 12 };
    case 'day':
      return {
        min: 1,
        max: parts.month === null ? 31 : daysInMonth(parts.year ?? 2028, parts.month),
      };
    case 'hour':
      return hour12 ? { min: 1, max: 12 } : { min: 0, max: 23 };
    case 'minute':
      return { min: 0, max: 59 };
    case 'dayPeriod':
      return { min: 0, max: 1 };
  }
}

/** Value of a segment as shown and spoken (`hour` on the clock of the locale), null if missing. */
export function segmentValue(
  type: SegmentType,
  parts: PartialDateTime,
  hour12: boolean,
): number | null {
  if (type === 'dayPeriod') {
    const pm = isPm(parts);
    return pm === null ? null : Number(pm);
  }
  if (type === 'hour' && hour12 && parts.hour !== null) return parts.hour % 12 || 12;
  return parts[type];
}

/** Number of digits of a segment once complete. */
export function segmentLength(type: SegmentType): number {
  return type === 'year' ? 4 : 2;
}

/** A segment set to a value of the clock of the locale. */
export function withSegment(
  parts: PartialDateTime,
  type: SegmentType,
  value: number | null,
  hour12: boolean,
): PartialDateTime {
  if (type === 'dayPeriod') {
    const pm = value === null ? null : value === 1;
    if (parts.hour === null || pm === null) return { ...parts, pm };
    return { ...parts, hour: (parts.hour % 12) + (pm ? 12 : 0), pm: null };
  }
  if (type === 'hour' && hour12 && value !== null) {
    return { ...parts, hour: (value % 12) + (isPm(parts) ? 12 : 0), pm: null };
  }
  return { ...parts, [type]: value };
}

/**
 * Arrow up or down: the next value, cycling within the bounds; an empty segment starts from the
 * reference (today in the zone for the date, the next hour for the time).
 */
export function stepSegment(
  parts: PartialDateTime,
  type: SegmentType,
  delta: number,
  hour12: boolean,
  reference: WallDateTime,
): PartialDateTime {
  const current = segmentValue(type, parts, hour12);
  const { min, max } = segmentRange(type, parts, hour12);
  if (current === null) {
    const start =
      type === 'dayPeriod'
        ? Number(reference.hour >= 12)
        : type === 'hour' && hour12
          ? reference.hour % 12 || 12
          : type === 'minute'
            ? 0
            : reference[type];
    return withSegment(parts, type, start, hour12);
  }
  const span = max - min + 1;
  const next = ((((current - min + delta) % span) + span) % span) + min;
  return withSegment(parts, type, next, hour12);
}

/**
 * A digit typed in a segment: appended to the digits typed so far, or a new start when the
 * number would leave the bounds. Moves on once no other digit could follow.
 */
export function typeDigit(
  parts: PartialDateTime,
  type: SegmentType,
  typed: string,
  digit: string,
  hour12: boolean,
): { parts: PartialDateTime; typed: string; advance: boolean } {
  const { min, max } = segmentRange(type, parts, hour12);
  const length = segmentLength(type);
  let text = `${typed}${digit}`.slice(-length);
  if (Number(text) > max) text = digit;
  const value = Number(text);
  const advance = text.length >= length || value * 10 > max;
  const valid = value >= min ? value : null;
  return { parts: withSegment(parts, type, valid, hour12), typed: advance ? '' : text, advance };
}

/** Backspace: the last digit typed goes, then the value. */
export function eraseDigit(
  parts: PartialDateTime,
  type: SegmentType,
  typed: string,
  hour12: boolean,
): { parts: PartialDateTime; typed: string } {
  const current = segmentValue(type, parts, hour12);
  const text = typed || (current === null || type === 'dayPeriod' ? '' : String(current));
  const rest = text.slice(0, -1);
  const value = rest === '' ? null : Number(rest);
  const { min } = segmentRange(type, parts, hour12);
  return {
    parts: withSegment(parts, type, value !== null && value >= min ? value : null, hour12),
    typed: rest,
  };
}

/** The complete date and time, or null while a part is missing. */
export function toWallDateTime(parts: PartialDateTime): WallDateTime | null {
  const { year, month, day, hour, minute } = parts;
  if (year === null || month === null || day === null || hour === null || minute === null) {
    return null;
  }
  return { year, month, day, hour, minute };
}

/** Parts of a complete date and time. */
export function fromWallDateTime(wall: WallDateTime): PartialDateTime {
  return { ...wall, pm: null };
}
