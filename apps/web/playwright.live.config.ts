import { defineConfig, devices } from '@playwright/test';

/**
 * Journeys against the real api (`pnpm --filter @pitchorium/web test:e2e:live`,
 * scripts/e2e-live.sh): web, api, worker, fake OAuth providers and the services of Docker
 * Compose are started by the script, then this suite runs in the official Playwright image.
 * Origins from LIVE_WEB_URL, LIVE_API_URL, MAILPIT_URL and FAKE_OAUTH_URL;
 * `test:e2e:live:run` runs it against servers already started (`pnpm dev`). Chromium runs every
 * journey, Firefox and WebKit the critical ones (`@critical`: authentication, onboarding,
 * profiles, organisations, network). One worker: the journeys read the same inbox.
 */
export default defineConfig({
  testDir: 'e2e-live',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 120_000,
  // A development server compiles each page on its first visit.
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.LIVE_WEB_URL ?? 'http://localhost:3200',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@critical/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, grep: /@critical/ },
  ],
});
