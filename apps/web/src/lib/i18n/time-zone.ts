import { isTimeZone } from '@pitchorium/contracts';

export { TIME_ZONE_COOKIE } from './time-zone-cookie';

/** Dates render in UTC until the browser has told its time zone. */
export const DEFAULT_TIME_ZONE = 'UTC';

export function timeZoneFrom(value: string | undefined): string {
  return value !== undefined && isTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
