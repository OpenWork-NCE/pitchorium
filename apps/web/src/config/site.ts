import { env } from '@/lib/env';

/** Proper noun of the brand, never translated (brand guide). */
export const SITE_NAME = 'Pitchorium';

export const siteConfig = {
  name: SITE_NAME,
  url: env.NEXT_PUBLIC_SITE_URL,
  apiUrl: env.NEXT_PUBLIC_API_URL,
  cdnUrl: env.NEXT_PUBLIC_CDN_URL,
} as const;
