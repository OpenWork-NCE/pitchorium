import { expect, test } from './support/fixtures';

test.describe('provisional home page', () => {
  test('renders in French with the brand, the fonts and the active locales', async ({ page }) => {
    await page.goto('/fr');
    await expect(page).toHaveTitle('Pitchorium');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Un réseau professionnel');
    await expect(page.getByRole('link', { name: 'Accueil de Pitchorium' })).toBeVisible();
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === 'loaded')
        .map((font) => font.weight);
    });
    expect(fonts).toEqual(expect.arrayContaining(['400', '800']));
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/en$/,
    );
    await expect(page.locator('link[rel="alternate"][hreflang="sw"]')).toHaveCount(0);
  });

  test('renders in English', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'A professional impact network',
    );
  });

  test('switches language among the active locales only', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Langue' }).click();
    const options = page.getByRole('menuitemradio');
    await expect(options).toHaveText(['Français', 'English']);
    await options.filter({ hasText: 'English' }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('plays the primary button and its toast', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Vérifier les fondations' }).click();
    await expect(page.getByText('Les fondations répondent.')).toBeVisible();
  });
});

test.describe('locales', () => {
  test('redirects an inactive locale to French', async ({ page }) => {
    const response = await page.goto('/sw');
    expect(response?.url()).toMatch(/\/fr$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('detects the language of the browser at the first visit', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-GB' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
    await context.close();
  });
});

test.describe('errors', () => {
  test('answers 404 with the localised page', async ({ page }) => {
    const response = await page.goto('/fr/cette-page-n-existe-pas');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cette page n’existe pas.');
    await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test('sends the member space to the sign-in page without a session', async ({ page }) => {
    await page.goto('/fr/feed');
    await expect(page).toHaveURL(/\/fr\/sign-in\?next=%2Ffr%2Ffeed$/);
  });
});
