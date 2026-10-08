import './zod';
import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/**
 * Configuration of the web app, validated when the module loads: `next.config.ts` imports it, so
 * `next build` fails on an invalid value. Server variables never reach the browser bundle.
 * Every variable is documented in `.env.example`.
 */
export const env = createEnv({
  server: {
    /** Origin of the api seen by the Next.js server (private network); NEXT_PUBLIC_API_URL otherwise. */
    API_INTERNAL_URL: z.url().optional(),
  },
  client: {
    /** Public origin of the web app (canonical URLs, sitemap, share images). */
    NEXT_PUBLIC_SITE_URL: z.url(),
    /** Public origin of the api, called by the browser with the session cookie. */
    NEXT_PUBLIC_API_URL: z.url(),
    /** Public base URL of the files (S3_PUBLIC_BASE_URL of the api): images and CSP. */
    NEXT_PUBLIC_CDN_URL: z.url().optional(),
    /** Sentry is active only when a DSN is set. */
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().min(1).default('development'),
    /** Vercel Analytics and Speed Insights, only on a Vercel deployment. */
    NEXT_PUBLIC_VERCEL_ANALYTICS: flag,
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_VERCEL_ANALYTICS,
  },
  emptyStringAsUndefined: true,
});
