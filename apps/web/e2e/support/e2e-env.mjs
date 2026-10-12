// Variables of the build of the end-to-end tests (.next-e2e) and of its server: the stub api on
// port 3299, the pages on 3201 (scripts/build-e2e.sh, playwright.config.ts).
export const E2E_ENV = {
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3201',
  NEXT_PUBLIC_API_URL: 'http://localhost:3299',
  NEXT_PUBLIC_CDN_URL: 'http://localhost:3299/files',
  NEXT_PUBLIC_VERCEL_ANALYTICS: 'false',
  NEXT_PUBLIC_SENTRY_DSN: '',
};
