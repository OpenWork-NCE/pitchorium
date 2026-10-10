import { expect, signIn, stub, test } from './support/fixtures';

/**
 * Reference screenshots of the provisional home page, compared in the official Playwright image
 * (playwright.config.ts). Reduced motion gives every element its final state.
 */
test.skip(
  !process.env.PLAYWRIGHT_IMAGE,
  'Screenshots compare in the Playwright image only (pnpm --filter @pitchorium/web test:e2e).',
);

// Every screenshot from the initial state of the stub api, whatever the journeys before it did.
test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

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

/**
 * Pages of resources (PROMPT FRONT 3): the public page of a member as a visitor reads it, and an
 * organisation as its owner reads it (stub api).
 */
const RESOURCE_PAGES = [
  { name: 'member-profile', path: '/fr/members/aissatou-ba', member: null },
  // The pages of the projects (PROMPT FRONT 5A): visitor and member views, funded and closed.
  { name: 'project-visitor', path: '/fr/projects/ferme-solaire-thies', member: null },
  {
    name: 'project-member',
    path: '/fr/projects/ferme-solaire-thies',
    member: 'aissatou.ba@demo.pitchorium.test',
  },
  { name: 'project-funded', path: '/fr/projects/cooperative-karite-kaolack', member: null },
  { name: 'project-closed', path: '/fr/projects/sechoirs-mbour', member: null },
  { name: 'showcase', path: '/fr/projects', member: null },
  { name: 'methodology', path: '/fr/impact/methodology', member: null },
  {
    name: 'organization',
    path: '/fr/organizations/fondation-teranga',
    member: 'aissatou.ba@demo.pitchorium.test',
  },
] as const;

for (const resource of RESOURCE_PAGES) {
  for (const viewport of VIEWPORTS) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${resource.name} ${viewport.name} ${colorScheme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        if (resource.member) await signIn(page, resource.member);
        await page.goto(resource.path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
        // Images loaded on approach (gallery, updates): all of them, so that the page is complete.
        await page.evaluate(async () => {
          for (const image of document.querySelectorAll('img')) image.loading = 'eager';
          await Promise.all(
            [...document.images].map((image) =>
              image.complete
                ? Promise.resolve()
                : new Promise((resolve) => (image.onload = image.onerror = resolve)),
            ),
          );
        });
        await expect(page).toHaveScreenshot(
          `${resource.name}-${viewport.name}-${colorScheme}.png`,
          { fullPage: true },
        );
        await context.close();
      });
    }
  }
}
