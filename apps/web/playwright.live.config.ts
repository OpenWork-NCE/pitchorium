import { defineConfig, devices } from '@playwright/test';

/**
 * Journeys of the authentication against the real api (PROMPT FRONT 2B): web, api, worker,
 * PostgreSQL, Valkey and Mailpit already running (`pnpm infra:up`, `pnpm dev`, or the processes
 * of verify:clean). Origins from LIVE_WEB_URL and MAILPIT_URL. One worker: the
 * journeys read the same inbox.
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
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
