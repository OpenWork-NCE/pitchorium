import type { PlaywrightTestConfig } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * Options shared by the stub and live suites (docs/architecture/testing.md, ADR 0123). In CI, one
 * retry with a trace of that retry; a test that only passes on its retry is flaky: it is listed in
 * the summary of the run (scripts/ci/playwright-summary.mjs, from the JSON report), and fails the
 * run when PLAYWRIGHT_FAIL_ON_FLAKY=1 (level 3).
 */
export const ciOptions = {
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  failOnFlakyTests: process.env.PLAYWRIGHT_FAIL_ON_FLAKY === '1',
  reporter: CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : 'list',
} satisfies PlaywrightTestConfig;

/** Trace of the first retry in CI, of any failure locally (no retry there). */
export const trace = CI ? 'on-first-retry' : 'retain-on-failure';
