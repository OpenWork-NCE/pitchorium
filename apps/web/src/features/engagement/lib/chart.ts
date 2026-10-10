import type { ImpactDashboard } from '@pitchorium/contracts';

/** A bar of the engagement chart: its month and its height in hundredths of the tallest. */
export interface ChartBar {
  month: string;
  given: ImpactDashboard['monthly'][number]['given'];
  /** 0 to 100, for drawing only: the amount shown is the one of the api. */
  height: number;
}

/** A month with money stays visible next to a much larger one. */
const MIN_HEIGHT = 2;

/**
 * Bars of the money given per month (section 9.4) from the series of the api, scaled to the
 * tallest month in exact integer arithmetic, a month with money at least 2 high: nothing is added up here, and a negative month (a
 * refund larger than what was given) is drawn as empty.
 */
export function chartBars(monthly: ImpactDashboard['monthly']): ChartBar[] {
  const values = monthly.map((entry) => {
    const value = BigInt(entry.given.amountMinor);
    return value > 0n ? value : 0n;
  });
  const max = values.reduce((top, value) => (value > top ? value : top), 0n);
  return monthly.map((entry, index) => ({
    month: entry.month,
    given: entry.given,
    height:
      max === 0n || values[index] === 0n
        ? 0
        : Math.max(MIN_HEIGHT, Number((values[index]! * 100n) / max)),
  }));
}

/** Hours and minutes of a count of minutes (`90` is 1 h 30), integers only. */
export function hoursAndMinutes(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
