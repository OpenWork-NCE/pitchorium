import { defineConfig, devices } from '@playwright/test';

/**
 * Captures of the product for the public site (scripts/marketing-captures.sh,
 * docs/design/marketing-captures.md): sections of the application on the build of the end-to-end
 * tests with the stub api and its demonstration data, in the official Playwright image.
 */
export default defineConfig({
  testDir: 'e2e/marketing',
  testMatch: '*.capture.ts',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    // Greyscale antialiasing, as the review captures (docs/design/review/README.md).
    launchOptions: { args: ['--disable-lcd-text'] },
  },
  webServer: {
    command: 'node e2e/support/serve.mjs',
    url: 'http://localhost:3201/fr',
    // MARKETING_REUSE=1: the server already started (a check during a change of the pages).
    reuseExistingServer: process.env.MARKETING_REUSE === '1',
    timeout: 120_000,
  },
});
