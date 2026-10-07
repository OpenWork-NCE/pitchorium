/** Day (UTC) of a view, `YYYY-MM-DD`: one view per visitor, visited member and day. */
export function dayOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First day of a window of `days` days ending today, today included. */
export function windowStart(now: Date, days: number): string {
  return dayOf(new Date(now.getTime() - (days - 1) * 86_400_000));
}

/** Sector shown for a private visit, « un membre du secteur X »; null when none is shown. */
export function anonymizedSector(sectors: readonly string[] | undefined): string | null {
  return sectors?.[0] ?? null;
}
