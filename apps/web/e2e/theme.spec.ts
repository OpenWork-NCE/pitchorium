import { allowConsole, expect, test } from './support/fixtures';

test.describe('theme', () => {
  test('applies a stored dark theme before any script of the app runs', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    // Without the JavaScript chunks only the inline theme script can act: no flash possible.
    allowConsole(/Failed to load resource: net::ERR_FAILED .*\/_next\/static\/chunks\//);
    await page.route('**/_next/static/chunks/**/*.js', (route) => route.abort());
    await page.goto('/fr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const background = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(background).toBe('rgb(18, 18, 18)');
  });

  test('follows the system preference by default', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/fr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await context.close();
  });

  test('switches from light to dark and remembers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Passer au thème sombre' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Passer au thème clair' })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
