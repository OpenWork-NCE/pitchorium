import { DEFAULT_LOCALE, type Locale, LOCALES } from '@pitchorium/contracts';
import { hasLocale } from 'next-intl';
import { defineRouting } from 'next-intl/routing';

/** Name of the cookie that remembers an explicit choice of language. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Every locale of the api is routable; the proxy narrows them per request to the active ones
 * (`GET /v1/locales`) and redirects an inactive locale to the default one (§4, §8.3).
 * hreflang comes from the metadata of the pages, limited to the active locales.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  alternateLinks: false,
  localeCookie: { name: LOCALE_COOKIE, maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
});

/** Locale of a route parameter, the default one when it is not a locale. */
export function asLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
