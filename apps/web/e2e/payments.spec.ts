import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, stub, test } from './support/fixtures';

const PROJECT = '/fr/projects/ferme-solaire-thies';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

/** Opens the journey and walks it to its quote with the keyboard where a choice is made. */
async function toQuote(page: Page) {
  await page.goto(PROJECT);
  await page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }).click();
  const dialog = page.getByTestId('contribute-dialog');
  // Each step at its own address before the next: the history of the browser keeps each one.
  const next = async (step: string) => {
    await dialog.getByRole('button', { name: 'Continuer' }).click();
    await expect(dialog).toHaveAttribute('data-step', step);
    await expect(page).toHaveURL(new RegExp(`contribute=${step}`));
  };
  await expect(dialog).toHaveAttribute('data-step', 'kind');
  await dialog.getByRole('radio', { name: /^Don/ }).focus();
  await page.keyboard.press('Space');
  await next('country');
  await next('amount');
  await dialog.getByRole('textbox', { name: /Montant/ }).fill('120');
  await next('behalf');
  await next('display');
  await next('method');
  await dialog.getByRole('radio', { name: /Carte bancaire/ }).click();
  await next('review');
  await expect(dialog.getByTestId('quote-summary')).toBeVisible();
  return dialog;
}

/** Contributing against the stub api (PROMPT FRONT 5B, ADR 0136 to 0138). */
test.describe('contributing', () => {
  test('walks the journey step by step, each at its address, back included', async ({ page }) => {
    await signIn(page, MEMBER);
    const dialog = await toQuote(page);
    await expect(dialog.getByTestId('quote-summary')).toContainText('6,00 €');
    await page.goBack();
    await expect(dialog).toHaveAttribute('data-step', 'method');
    await expect(page).toHaveURL(/contribute=method/);
  });

  test('creates one contribution for a double click and leaves for the page of the provider', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.route('**/__test/checkout', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>Prestataire</title>',
      }),
    );
    const dialog = await toQuote(page);
    await Promise.all([page.waitForURL(/__test\/checkout/), dialog.getByTestId('pay').dblclick()]);
    const writes = (await stub(request).writes()).filter((write) => write.route === 'contribution');
    expect(writes).toHaveLength(1);
    expect(writes[0]!.key).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('says each state of a project honestly, and keeps a pending payment', async ({
    page,
    context,
  }) => {
    await signIn(page, MEMBER);
    await context.addCookies([
      { name: 'stub_availability', value: 'funding_frozen', domain: 'localhost', path: '/' },
    ]);
    await page.goto(PROJECT);
    const entry = page.getByTestId('contribute-entry');
    await expect(entry).toContainText('Contributions suspendues');
    await expect(entry).not.toContainText('terminée');
    await expect(entry.getByRole('button', { name: 'Contribuer' })).toHaveCount(0);
    await context.addCookies([
      { name: 'stub_availability', value: 'open', domain: 'localhost', path: '/' },
      { name: 'stub_pending', value: '1', domain: 'localhost', path: '/' },
    ]);
    await page.reload();
    await expect(entry.getByRole('button', { name: 'Reprendre le paiement' })).toBeVisible();
  });

  test('follows a pending payment on the return page without saying it is paid', async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/contributions/0192f4a0-5000-7000-8000-000000000001/return');
    await expect(
      page.getByRole('heading', { name: 'Paiement en cours de confirmation' }),
    ).toBeVisible();
    await expect(page.getByText('Merci, votre contribution est confirmée')).toHaveCount(0);
    await page.goto('/fr/contributions/0192f4a0-5000-7000-8000-000000000002/return');
    await expect(
      page.getByRole('heading', { name: 'Merci, votre contribution est confirmée' }),
    ).toBeVisible();
    await expect(page.getByText('Cette confirmation n’est pas un reçu fiscal.')).toBeVisible();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no accessibility violation in the journey, the payouts and the dashboard (${colorScheme})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signIn(page, MEMBER);
      await toQuote(page);
      const journey = await new AxeBuilder({ page })
        .include('[data-testid="contribute-dialog"]')
        .analyze();
      expect(journey.violations).toEqual([]);
      for (const path of ['/fr/settings/payouts', '/fr/dashboard', '/fr/dashboard/time']) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('networkidle');
        const audit = await new AxeBuilder({ page }).include('main').analyze();
        expect(audit.violations, path).toEqual([]);
      }
      await context.close();
    });
  }
});

/** Reference screenshots of the quote, compared in the Playwright image only. */
test.describe('contributing screenshots', () => {
  test.skip(!process.env.PLAYWRIGHT_IMAGE, 'Screenshots compare in the Playwright image only.');
  // One reference per screen, drawn by Chromium, as the other reference screenshots (visual.spec).
  test.skip(({ browserName }) => browserName !== 'chromium', 'References are drawn by Chromium.');
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`quote of a contribution ${colorScheme}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        colorScheme,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await signIn(page, MEMBER);
      const dialog = await toQuote(page);
      await page.evaluate(() => document.fonts.ready);
      await expect(dialog).toHaveScreenshot(`contribution-quote-${colorScheme}.png`);
      await context.close();
    });
  }
});

/** On a phone, the action bar opens the journey on the whole screen (ADR 0132, ADR 0136). */
test.describe('contributing on a phone', { tag: '@phone' }, () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens the journey on the whole screen of a phone', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto(PROJECT);
    await page.getByTestId('contribute-bar').click();
    const dialog = page.getByTestId('contribute-dialog');
    await expect(dialog).toHaveAttribute('data-step', 'kind');
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.width)).toBe(viewport.width);
    expect(Math.round(box.height)).toBe(viewport.height);
  });
});
