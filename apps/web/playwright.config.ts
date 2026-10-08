import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 3201;
const API_PORT = 3299;
const webOrigin = `http://localhost:${WEB_PORT}`;
const apiOrigin = `http://localhost:${API_PORT}`;

/**
 * End-to-end tests of the web app (ADR 0090): a production build in its own directory against
 * a stub api, Chromium only. `test:e2e` runs in the official Playwright image (same fonts and
 * rendering locally and in CI) where the screenshots are compared; `test:e2e:native` skips them.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'node e2e/support/stub-api.mjs',
      url: `${apiOrigin}/v1/locales`,
      env: { STUB_API_PORT: String(API_PORT), STUB_WEB_ORIGIN: webOrigin },
      reuseExistingServer: false,
    },
    {
      // Explicit binaries: the Docker image has no pnpm to put node_modules/.bin on the PATH.
      command: `./node_modules/.bin/next build && ./node_modules/.bin/next start --port ${WEB_PORT}`,
      url: `${webOrigin}/fr`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_SITE_URL: webOrigin,
        NEXT_PUBLIC_API_URL: apiOrigin,
        NEXT_PUBLIC_CDN_URL: `${apiOrigin}/files`,
        NEXT_PUBLIC_VERCEL_ANALYTICS: 'false',
        NEXT_PUBLIC_SENTRY_DSN: '',
      },
    },
  ],
});
