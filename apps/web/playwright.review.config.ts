import { defineConfig, devices } from '@playwright/test';
import { ciOptions } from './e2e/support/ci-options';

const PORT = 6106;

/**
 * Captures of the reference compositions for the design review (docs/design/review), taken from
 * the static Storybook, and of the pages of the projects from the build of the end-to-end tests
 * with the stub api, in the official Playwright image (scripts/review-captures.sh): the same
 * rendering as the reference screenshots of the end-to-end tests. `review:captures` writes them
 * (--update-snapshots=all); `review:check` compares them with the committed ones, with the
 * tolerance of the end-to-end screenshots (level 3, docs/architecture/testing.md).
 */
export default defineConfig({
  testDir: 'e2e/review',
  testMatch: '*.review.ts',
  fullyParallel: true,
  ...ciOptions,
  snapshotPathTemplate: '{testDir}/../../../../docs/design/review/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    // Greyscale antialiasing: the subpixel one of the image draws coloured fringes on large bold
    // text, a rendering of the capture, not of the page (docs/design/review/README.md).
    launchOptions: { args: ['--disable-lcd-text'] },
  },
  webServer: [
    {
      command: `node e2e/support/serve-static.mjs storybook-static ${PORT}`,
      url: `http://localhost:${PORT}/index.json`,
      reuseExistingServer: false,
    },
    {
      // The pages of the projects and of the impact (e2e/review/pages.review.ts): the build of
      // the end-to-end tests with the stub api.
      command: 'node e2e/support/serve.mjs',
      url: 'http://localhost:3201/fr',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
