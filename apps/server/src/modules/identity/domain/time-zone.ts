import { DEFAULT_TIME_ZONE, isTimeZone } from '@pitchorium/contracts';

/** The time zone declared by the client at sign-up when it is a known IANA zone, UTC otherwise. */
export function timeZoneOrDefault(header: string | null | undefined): string {
  const value = header?.trim() ?? '';
  return isTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
