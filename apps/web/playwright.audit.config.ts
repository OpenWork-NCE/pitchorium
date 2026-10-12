import { defineConfig, devices } from '@playwright/test';
import { ciOptions, trace } from './e2e/support/ci-options';
import { E2E_ENV } from './e2e/support/e2e-env.mjs';
import { stubClockEnv } from './e2e/support/stub-clock.mjs';

const WEB_PORT = 3201;
const API_PORT = 3299;
const clock = stubClockEnv();

/**
 * Audit of every screen (e2e/audit, PROMPT FRONT 9B): the build of the end-to-end tests
 * (.next-e2e) with the stub api, in Chromium, in the official Playwright image
 * (scripts/audit-screens.sh), the fonts and the rendering of the CI. With AUDIT_PSEUDO=1 the server
 * of the pages pseudo-localizes every text (WEB_PSEUDO_LOCALIZATION, src/lib/i18n/pseudo-locale.ts).
 * One worker: the stub api keeps one state.
 */
export default defineConfig({
  testDir: 'e2e/audit',
  testMatch: '*.audit.ts',
  fullyParallel: true,
  workers: 1,
  ...ciOptions,
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${WEB_PORT}`, trace },
  webServer: [
    {
      command: 'node e2e/support/stub-api.mjs',
      url: `http://localhost:${API_PORT}/v1/locales`,
      env: {
        STUB_API_PORT: String(API_PORT),
        STUB_WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        ...clock,
      },
      reuseExistingServer: false,
    },
    {
      command: `./node_modules/.bin/next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/fr`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...E2E_ENV,
        WEB_PSEUDO_LOCALIZATION: process.env.AUDIT_PSEUDO === '1' ? 'true' : 'false',
        ...clock,
      },
    },
  ],
});
