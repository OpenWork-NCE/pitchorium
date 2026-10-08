'use client';

import { useEffect } from 'react';
import { TIME_ZONE_COOKIE } from '@/lib/i18n/time-zone-cookie';

/**
 * Tells the server the time zone of the browser (cookie read by the i18n request
 * configuration): dates render in the visitor's time zone from the next request on.
 */
export function TimeZoneSync() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.split('=')[1];
    if (zone && decodeURIComponent(current ?? '') !== zone) {
      document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    }
  }, []);
  return null;
}
