import { defineConfig, devices } from '@playwright/test';
import { ciOptions, trace } from './e2e/support/ci-options';

/**
 * Journeys against the real api (`pnpm --filter @pitchorium/web test:e2e:live`,
 * scripts/e2e-live.sh): web, api, worker, fake OAuth providers and the services of Docker
 * Compose are started by the script, then this suite runs in the official Playwright image.
 * Origins from LIVE_WEB_URL, LIVE_API_URL, MAILPIT_URL and FAKE_OAUTH_URL;
 * `test:e2e:live:run` runs it against servers already started (`pnpm dev`). Every project runs
 * every journey; the push of a commit runs the critical ones (`@critical`, ADR 0127) in Chromium,
 * the nightly run all of them in the three engines (docs/architecture/testing.md). One worker:
 * the journeys read the same inbox.
 */
export default defineConfig({
  testDir: 'e2e-live',
  workers: 1,
  fullyParallel: false,
  ...ciOptions,
  timeout: 120_000,
  // A development server compiles each page on its first visit.
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.LIVE_WEB_URL ?? 'http://localhost:3200',
    trace,
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
