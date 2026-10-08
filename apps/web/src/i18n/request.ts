import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { messagesFor } from '@/lib/i18n/messages';
import { TIME_ZONE_COOKIE, timeZoneFrom } from '@/lib/i18n/time-zone';
import { routing } from './routing';

/** Locale, messages and time zone of each request (next-intl). */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const store = await cookies();
  return {
    locale,
    messages: messagesFor(locale),
    timeZone: timeZoneFrom(store.get(TIME_ZONE_COOKIE)?.value),
  };
});
