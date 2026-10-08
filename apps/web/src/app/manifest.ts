import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { SITE_NAME } from '@/config/site';
import { brandColors } from '@/styles/brand';

/** Web manifest: the application icons of the brand kit (dark variant, full background). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: `/${routing.defaultLocale}`,
    display: 'standalone',
    background_color: brandColors.white,
    theme_color: brandColors.violet,
    icons: [
      { src: '/brand/app-icon-dark-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/app-icon-dark-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
