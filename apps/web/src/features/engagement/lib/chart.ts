import type { ImpactDashboard } from '@pitchorium/contracts';

/**
 * Values of the money given per month (section 9.4) for the bar chart: the amounts of the api in
 * minor units, drawn only. Nothing is added up here: the total of the twelve months is the api's
 * (`givenLastTwelveMonths`).
 */
export function monthlyValues(monthly: ImpactDashboard['monthly']): number[] {
  return monthly.map((entry) => Number(BigInt(entry.given.amountMinor)));
}

/** Hours and minutes of a count of minutes (`90` is 1 h 30), integers only. */
export function hoursAndMinutes(minutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
