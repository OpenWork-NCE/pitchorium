import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';

const PAGES = [
  '/fr',
  '/en',
  '/fr/page-absente',
  '/fr/sign-in',
  '/fr/sign-up',
  '/fr/forgot-password',
];

test.describe('accessibility', () => {
  for (const path of PAGES) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} has no axe violation in the ${colorScheme} theme`, async ({ browser }) => {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.goto(path);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.length}`)).toEqual([]);
        await context.close();
      });
    }
  }
});

test.describe('content security policy', () => {
  test('is sent with a nonce and violated by nothing on the page', async ({
    page,
    cspViolations,
  }) => {
    const response = await page.goto('/fr');
    const policy = response?.headers()['content-security-policy'] ?? '';
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    // Exercise what injects scripts or styles: theme, language panel, layout animation.
    await page.getByRole('button', { name: 'Passer au thème sombre' }).click();
    await page.getByRole('button', { name: 'Langue' }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Clair' }).click();
    await page.getByRole('button', { name: 'Vérifier les fondations' }).click();
    await expect(page.getByText('Les fondations répondent.')).toBeVisible();
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(500);
    expect(cspViolations).toEqual([]);
  });
});
