import { defineConfig, devices } from '@playwright/test';

const PORT = 6106;

/**
 * Captures of the reference compositions for the design review (docs/design/review), taken from
 * the static Storybook in the official Playwright image (scripts/review-captures.sh): the same
 * rendering as the reference screenshots of the end-to-end tests.
 */
export default defineConfig({
  testDir: 'e2e/review',
  testMatch: '*.review.ts',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Desktop Chrome'] },
  webServer: {
    command: `node e2e/support/serve-static.mjs storybook-static ${PORT}`,
    url: `http://localhost:${PORT}/index.json`,
    reuseExistingServer: false,
  },
});
