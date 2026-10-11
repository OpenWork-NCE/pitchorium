import { expect, test } from './support';

/**
 * The public site against the real api (PROMPT FRONT 8A, ADR 0156, 0157): every page in the
 * visitor's view, with its metadata, without console error nor CSP violation (fixture).
 */
test.describe('public editorial site', () => {
  const PAGES = [
    { path: '/fr', title: 'Pitchorium' },
    { path: '/fr/how-it-works', title: /Comment fonctionne Pitchorium/ },
    { path: '/fr/transparency', title: /Transparence et frais/ },
    { path: '/en/legal/privacy', title: /Privacy policy/ },
  ];

  test(
    'renders each page for a visitor with its canonical address and description',
    { tag: '@critical' },
    async ({ page }) => {
      for (const { path, title } of PAGES) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page).toHaveTitle(title);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          new RegExp(`${path}$`),
        );
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      }
    },
  );

  test(
    'describes Pitchorium in structured data and features real projects of the api',
    { tag: '@critical' },
    async ({ page, request }) => {
      const API_URL = process.env.LIVE_API_URL ?? 'http://localhost:3100';
      const showcase = (await (
        await request.get(`${API_URL}/v1/public/projects?limit=3`)
      ).json()) as { items: { title: string }[] };
      await page.goto('/fr');
      const types = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts) =>
          scripts.map(
            (script) => (JSON.parse(script.textContent ?? '{}') as { '@type': string })['@type'],
          ),
        );
      expect(types.sort()).toEqual(['Organization', 'WebSite']);
      const cards = page.locator('[data-home-projects] li');
      if (showcase.items.length > 0) {
        await expect(cards.first()).toBeVisible();
        const shown = await cards.getByRole('heading').allTextContents();
        expect(shown.length).toBeGreaterThan(0);
      } else {
        await expect(cards).toHaveCount(0);
      }
    },
  );

  test(
    'reads the commission and the legal versions from the api',
    { tag: '@critical' },
    async ({ page, request }) => {
      const API_URL = process.env.LIVE_API_URL ?? 'http://localhost:3100';
      const coverage = (await (
        await request.get(`${API_URL}/v1/public/payments/coverage`)
      ).json()) as { commission: { rateBps: number } };
      const legal = (await (await request.get(`${API_URL}/v1/legal-documents/current`)).json()) as {
        termsVersion: string;
      };
      await page.goto('/fr/transparency');
      await expect(
        page.locator(`[data-commission-rate="${coverage.commission.rateBps}"]`),
      ).toBeVisible();
      await page.goto('/fr/legal/terms');
      await expect(page.locator(`[data-legal-version="${legal.termsVersion}"]`)).toBeVisible();
      await expect(page.getByText('Texte en attente de validation juridique')).toBeVisible();
    },
  );

  test('shows the final state at once with less motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    for (const path of ['/fr', '/fr/how-it-works']) {
      await page.goto(path);
      const running = await page.evaluate(
        () =>
          document.getAnimations().filter((animation) => animation.playState === 'running').length,
      );
      expect(running, path).toBe(0);
    }
    await context.close();
  });
});
