import { defineConfig, devices } from '@playwright/test';
import { ciOptions, trace } from './e2e/support/ci-options';

const WEB_PORT = 3201;
const API_PORT = 3299;
const webOrigin = `http://localhost:${WEB_PORT}`;
const apiOrigin = `http://localhost:${API_PORT}`;

/** Measures of the rendering engine of Chromium (screenshots, CPU throttling through CDP). */
const CHROMIUM_ONLY = [/visual\.spec\.ts/, /responsiveness\.spec\.ts/];

/**
 * End-to-end tests of the web app (ADR 0090): a production build in its own directory against
 * a stub api, in Chromium, Firefox and WebKit, and in WebKit as an iPhone for the journeys on a
 * phone (tag `@phone`): part of the diaspora reads Pitchorium in Safari on an iPhone. `test:e2e`
 * runs in the official Playwright image (same engines, fonts and rendering locally and in CI)
 * where the screenshots of Chromium are compared; `test:e2e:native` skips them. One worker: the
 * stub api keeps one state (sessions, counters, log of the writes) for every test. With
 * E2E_SKIP_BUILD=1 the build of .next-e2e already there is served (the CI builds it once per run).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  workers: 1,
  ...ciOptions,
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: { baseURL: webOrigin, trace },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // The page opts into its own process (Cross-Origin-Opener-Policy): Firefox then drops
        // the emulated colour scheme of the context. Kept in one process, the dark theme of the
        // system reaches the page as it does for a member.
        launchOptions: {
          firefoxUserPrefs: { 'browser.tabs.remote.useCrossOriginOpenerPolicy': false },
        },
      },
      testIgnore: CHROMIUM_ONLY,
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: CHROMIUM_ONLY },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
      grep: /@phone/,
      testIgnore: CHROMIUM_ONLY,
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/stub-api.mjs',
      url: `${apiOrigin}/v1/locales`,
      env: { STUB_API_PORT: String(API_PORT), STUB_WEB_ORIGIN: webOrigin },
      reuseExistingServer: false,
    },
    {
      // Explicit binaries: the Docker image has no pnpm to put node_modules/.bin on the PATH.
      command: `${process.env.E2E_SKIP_BUILD === '1' ? '' : './node_modules/.bin/next build && '}./node_modules/.bin/next start --port ${WEB_PORT}`,
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
