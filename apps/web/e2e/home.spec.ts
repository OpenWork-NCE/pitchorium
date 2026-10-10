import { allowConsole, expect, test } from './support/fixtures';

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

  test('switches language among the active locales only, and remembers it', async ({ page }) => {
    await page.goto('/fr?ref=test');
    const toggle = page.getByRole('button', { name: 'Langue' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const options = page
      .locator(`#${await toggle.getAttribute('aria-controls')}`)
      .getByRole('link');
    await expect(options).toHaveText(['Français', 'English']);
    await expect(options.first()).toHaveAttribute('aria-current', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await toggle.click();
    await options.filter({ hasText: 'English' }).click();
    await expect(page).toHaveURL(/\/en\?ref=test$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);
  });

  test('answers the primary button in place', async ({ page }) => {
    await page.goto('/fr');
    await page.getByRole('button', { name: 'Vérifier les fondations' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Les fondations répondent.' }),
    ).toBeVisible();
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
    // The browser reports the 404 of the document it opens on purpose.
    allowConsole(/status of 404 \(Not Found\)/);
    const response = await page.goto('/fr/cette-page-n-existe-pas');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cette page n’existe pas.');
    await page.getByRole('link', { name: 'Revenir à l’accueil' }).click();
    await expect(page).toHaveURL(/\/fr$/);
  });

  test('sends the member space to the sign-in page without a session', async ({ page }) => {
    await page.goto('/fr/feed');
    await expect(page).toHaveURL(/\/fr\/sign-in\?redirectTo=%2Ffr%2Ffeed$/);
    await expect(
      page.getByRole('heading', { name: 'Rejoindre Pitchorium', level: 1 }),
    ).toBeVisible();
  });
});

test.describe('sign-in page', () => {
  test('keeps the brand panel of a phone still while the page streams in @phone', async ({
    page,
  }) => {
    // Painted under the empty card of the loading state, the panel was pushed down by the form
    // (layout shift on a slow network): invisible on a phone while the loading state is there.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fr/sign-in');
    const panel = page.getByRole('complementary', { name: 'Pitchorium' });
    await expect(panel).toBeVisible();
    // The loading state, then the form that replaces it and grows the card.
    const shift = await page.getByRole('main').evaluate(async (main) => {
      let total = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          total += (entry as unknown as { value: number }).value;
      }).observe({ type: 'layout-shift' });
      const frame = () =>
        new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)));
      const loading = Object.assign(document.createElement('div'), { hidden: true });
      loading.setAttribute('data-page-loading', '');
      main.append(loading);
      await frame();
      const form = Object.assign(document.createElement('div'), { style: 'height: 400px' });
      main.append(form);
      await frame();
      loading.remove();
      await frame();
      await frame();
      form.remove();
      return total;
    });
    expect(shift).toBe(0);
    await expect(panel).toBeVisible();
  });
});
