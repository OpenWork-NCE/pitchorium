import type { EmailDigest } from '@pitchorium/contracts';

export interface LocalTime {
  /** YYYY-MM-DD in the time zone. */
  date: string;
  hour: number;
  /** 1 for Monday to 7 for Sunday. */
  weekday: number;
}

const WEEKDAYS: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** Date, hour and weekday of an instant in an IANA time zone. */
export function localTime(at: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hour: Number(part('hour')),
    weekday: WEEKDAYS[part('weekday')] ?? 0,
  };
}

/** Day the weekly digest is sent: Monday (provisional, docs/open-questions.md). */
export const WEEKLY_DIGEST_WEEKDAY = 1;

/**
 * A digest is due once per local day (daily) or per local Monday (weekly), from the digest
 * hour of the member's time zone (ADR 0061).
 */
export function isDigestDue(input: {
  now: Date;
  timeZone: string;
  digest: EmailDigest;
  lastDigestAt: Date | null;
  hour: number;
}): boolean {
  if (input.digest === 'off') return false;
  const local = localTime(input.now, input.timeZone);
  if (local.hour < input.hour) return false;
  if (input.digest === 'weekly' && local.weekday !== WEEKLY_DIGEST_WEEKDAY) return false;
  if (!input.lastDigestAt) return true;
  return localTime(input.lastDigestAt, input.timeZone).date !== local.date;
}
