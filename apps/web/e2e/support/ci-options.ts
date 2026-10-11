import type { PlaywrightTestConfig } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * Options shared by the stub and live suites (docs/architecture/testing.md, ADR 0123). In CI, one
 * retry, with the trace and the video of the first failure kept; a test that only passes on its retry is flaky: it is listed in
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
 * Trace of every failed attempt, the first one included and not only its retry (FRONT 8A, A2):
 * an instability is read on the run that failed. PLAYWRIGHT_TRACE overrides it.
 */
export const trace: Recording = recording('PLAYWRIGHT_TRACE') ?? 'retain-on-failure';

/** Video of every failed attempt in CI; none locally unless PLAYWRIGHT_VIDEO asks for one. */
export const video: Recording = recording('PLAYWRIGHT_VIDEO') ?? (CI ? 'retain-on-failure' : 'off');
