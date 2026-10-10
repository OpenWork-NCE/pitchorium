import type { MetadataRoute } from 'next';
import { routes } from '@/config/routes';
import { localizedUrl } from '@/config/seo';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { PUBLIC_SITEMAP_SOURCES } from '@/lib/seo/sitemap-sources';

/**
 * Public pages, in every active locale with their alternates: the home page, the showcase of the
 * projects, then the pages of the public resources, at their one address (ADR 0101).
 */
const STATIC_PATHS = ['/', routes.projects, routes.impactMethodology] as const;

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
