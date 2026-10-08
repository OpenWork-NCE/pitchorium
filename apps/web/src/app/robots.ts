import type { MetadataRoute } from 'next';
import { ADMIN_SEGMENTS, MEMBER_SEGMENTS, routes } from '@/config/routes';
import { siteConfig } from '@/config/site';

const PRIVATE_SEGMENTS = [...MEMBER_SEGMENTS, ...ADMIN_SEGMENTS, routes.health.slice(1)];

/** Crawlers read the public pages; the member space, the administration and tools are not indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_SEGMENTS.map((segment) => `/*/${segment}`),
      },
    ],
    sitemap: new URL('/sitemap.xml', siteConfig.url).toString(),
  };
}
