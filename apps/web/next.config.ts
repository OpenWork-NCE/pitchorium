import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { redirects } from './src/config/redirects';
import { env } from './src/lib/env';

/** Remote images: the public files of the api only (its CDN), nothing else. */
function remotePatterns(): NonNullable<NonNullable<NextConfig['images']>['remotePatterns']> {
  if (!env.NEXT_PUBLIC_CDN_URL) return [];
  const cdn = new URL(env.NEXT_PUBLIC_CDN_URL);
  return [
    {
      protocol: cdn.protocol.replace(':', '') as 'http' | 'https',
      hostname: cdn.hostname,
      port: cdn.port,
      pathname: `${cdn.pathname.replace(/\/$/, '')}/**`,
    },
  ];
}

const localCdn = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.NEXT_PUBLIC_CDN_URL ?? '');

/** Security headers of every response; the CSP is set per request by src/proxy.ts. */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(env.NEXT_PUBLIC_SITE_URL.startsWith('https://')
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  // The end-to-end tests build into their own directory (playwright.config.ts).
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  reactStrictMode: true,
  reactCompiler: true,
  poweredByHeader: false,
  typedRoutes: false,
  experimental: {
    // Barrel files of these packages are resolved import by import: only the used modules ship.
    optimizePackageImports: ['motion', 'radix-ui'],
  },
  images: {
    remotePatterns: remotePatterns(),
    formats: ['image/avif', 'image/webp'],
    // MinIO answers on localhost in development only (Next.js 16 refuses local IPs by default).
    dangerouslyAllowLocalIP: localCdn,
  },
  redirects: () => Promise.resolve(redirects),
  headers: () => Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]),
};

export default withSentryConfig(nextConfig, {
  // Source maps are uploaded only when the build has a token (CI of a deployment).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
