import { createRequire } from 'node:module';
import { relative } from 'node:path';
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
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

/**
 * The messages are compiled ahead of time (src/lib/i18n/messages.ts, icu-minify): next-intl
 * formats them with its formatter of compiled messages, and the parser of ICU messages leaves the
 * bundles (the alias next-intl sets for its own `precompile`, relative as Turbopack wants it).
 */
const formatOnly = relative(
  process.cwd(),
  createRequire(createRequire(`${process.cwd()}/package.json`).resolve('next-intl')).resolve(
    'use-intl/format-message/format-only',
  ),
);

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
  // Browser source maps exist only in a build that publishes them to Sentry, which deletes them
  // after the upload (withSentryConfig below): never among the public files.
  productionBrowserSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
  typedRoutes: false,
  // `next dev` would write an AGENTS.md of its own when it detects a coding agent: the rules of
  // the repository live in the root AGENTS.md only.
  agentRules: false,
  turbopack: {
    resolveAlias: {
      'use-intl/format-message': formatOnly.startsWith('.') ? formatOnly : `./${formatOnly}`,
    },
  },
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

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Release of the build, named by the commit (docs/operations/deployment-web.md): SENTRY_RELEASE,
 * or the commit Vercel builds. The SDK reads it from the build, the server and the browser alike.
 */
const sentryRelease = process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA;

export default withSentryConfig(withNextIntl(nextConfig), {
  // The release and its source maps are published only when the build has a token (a deployment).
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  release: {
    ...(sentryRelease ? { name: sentryRelease } : {}),
    // The commits come from the integration of the repository in Sentry, not from a clone that
    // a deployment does not have.
    setCommits: false,
    deploy: process.env.SENTRY_AUTH_TOKEN
      ? { env: env.NEXT_PUBLIC_SENTRY_ENVIRONMENT, url: env.NEXT_PUBLIC_SITE_URL }
      : false,
  },
  sourcemaps: {
    // Uploaded to Sentry, then deleted from the build: never served with the pages
    // (scripts/check-bundles.mjs refuses a source map among the public files).
    deleteSourcemapsAfterUpload: true,
  },
  silent: !process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
});
