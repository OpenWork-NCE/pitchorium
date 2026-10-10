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

type Recording = 'on' | 'off' | 'retain-on-failure' | 'on-first-retry';

/** A recording mode asked by the environment (the diagnosis workflow, ADR 0142), if valid. */
function recording(name: string): Recording | undefined {
  const value = process.env[name];
  return value === 'on' ||
    value === 'off' ||
    value === 'retain-on-failure' ||
    value === 'on-first-retry'
    ? value
    : undefined;
}

/**
 * Trace of the first retry in CI, of any failure locally (no retry there); PLAYWRIGHT_TRACE
 * overrides it (`retain-on-failure` when a journey repeats without retry).
 */
export const trace: Recording =
  recording('PLAYWRIGHT_TRACE') ?? (CI ? 'on-first-retry' : 'retain-on-failure');

/** No video, unless PLAYWRIGHT_VIDEO asks for one (the diagnosis workflow). */
export const video: Recording = recording('PLAYWRIGHT_VIDEO') ?? 'off';
