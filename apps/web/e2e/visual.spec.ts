import { expect, signIn, test } from './support/fixtures';

/**
 * Reference screenshots of the provisional home page, compared in the official Playwright image
 * (playwright.config.ts). Reduced motion gives every element its final state.
 */
test.skip(
  !process.env.PLAYWRIGHT_IMAGE,
  'Screenshots compare in the Playwright image only (pnpm --filter @pitchorium/web test:e2e).',
);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of VIEWPORTS) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`home ${viewport.name} ${colorScheme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto('/fr');
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`home-${viewport.name}-${colorScheme}.png`, {
        fullPage: true,
      });
      await context.close();
    });
  }
}

/** Shell of the member space, signed in with a demonstration account (stub api). */
for (const viewport of VIEWPORTS) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`member shell ${viewport.name} ${colorScheme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await signIn(page, 'aissatou.ba@demo.pitchorium.test');
      await page.goto('/fr/feed');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`member-shell-${viewport.name}-${colorScheme}.png`);
      await context.close();
    });
  }
}
