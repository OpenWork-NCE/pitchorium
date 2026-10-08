import type { Locale } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { routing } from '@/i18n/routing';
import { siteConfig } from './site';

/** Absolute URL of a path in a locale (`/` is the home page of the locale). */
export function localizedUrl(locale: Locale, path: string): string {
  const suffix = path === '/' ? '' : path;
  return new URL(`/${locale}${suffix}`, siteConfig.url).toString();
}

/**
 * Canonical URL and hreflang alternates of a page, limited to the active locales (§8.3):
 * an inactive locale is never announced to search engines.
 */
export function alternatesFor(
  locale: Locale,
  path: string,
  activeLocales: readonly Locale[],
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = Object.fromEntries(
    activeLocales.map((active) => [active, localizedUrl(active, path)]),
  );
  if (activeLocales.includes(routing.defaultLocale)) {
    languages['x-default'] = localizedUrl(routing.defaultLocale, path);
  }
  return { canonical: localizedUrl(locale, path), languages };
}
