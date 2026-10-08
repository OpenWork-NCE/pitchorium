import 'server-only';
import type { Locale } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { alternatesFor } from '@/config/seo';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { type ResourceView, robotsOf } from './view';

/**
 * Metadata of the page of a resource: its name, its canonical address and the alternates of the
 * active locales, indexed in its public view only; a resource absent for the reader, never.
 */
export async function resourceMetadata(
  locale: Locale,
  path: string,
  resource: ResourceView<unknown> | null,
  title: string | undefined,
): Promise<Metadata> {
  if (!resource || !title) return { robots: { index: false, follow: false } };
  const { locales } = await getActiveLocales();
  return {
    title,
    alternates: alternatesFor(locale, path, locales),
    robots: robotsOf(resource.view),
  };
}
