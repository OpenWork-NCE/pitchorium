import type { MetadataRoute } from 'next';
import { localizedUrl } from '@/config/seo';
import { getActiveLocales } from '@/lib/i18n/active-locales';

/**
 * Static public pages, in every active locale with their alternates. The dynamic public pages
 * (profiles, organisations, projects, events) join through PUBLIC_SITEMAP_SOURCES when they
 * exist, each source listing its paths.
 */
const STATIC_PATHS = ['/'] as const;

type SitemapSource = () => Promise<string[]>;

/** Filled by the features of the public pages (PROMPT FRONT 1 onwards). */
const PUBLIC_SITEMAP_SOURCES: SitemapSource[] = [];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { locales } = await getActiveLocales();
  const dynamicPaths = (await Promise.all(PUBLIC_SITEMAP_SOURCES.map((source) => source()))).flat();
  return [...STATIC_PATHS, ...dynamicPaths].flatMap((path) =>
    locales.map((locale) => ({
      url: localizedUrl(locale, path),
      alternates: {
        languages: Object.fromEntries(locales.map((other) => [other, localizedUrl(other, path)])),
      },
    })),
  );
}

export const dynamic = 'force-dynamic';
