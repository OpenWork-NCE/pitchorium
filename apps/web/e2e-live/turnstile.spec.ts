import { expect, type Page, test } from '@playwright/test';
import { freshEmail, hydrated, PASSWORD } from './support';

/** Test keys of Cloudflare Turnstile: the live environment uses the one that always passes. */
const PASSING_SITE_KEY = '1x00000000000000000000AA';
const FAILING_SITE_KEY = '2x00000000000000000000AB';
const CHALLENGES = 'https://challenges.cloudflare.com';

/** Violations of the Content Security Policy of the page, gathered from its first script. */
async function watchCsp(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(
        `${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
}

async function fillSignUp(page: Page, email: string) {
  await page.getByLabel('Nom', { exact: true }).fill('Awa Diallo');
  await page.getByLabel('Adresse email').fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

/**
 * Cloudflare Turnstile in the browser (A3, ADR 0103): the widget of the test keys, the script
 * and the frame the policy allows, and nothing else; a challenge that fails stops the sign-up.
 */
test.describe('Cloudflare Turnstile', { tag: '@critical' }, () => {
  test('a passed challenge lets the sign-up through, without any CSP violation', async ({
    page,
  }) => {
    const violations = await watchCsp(page);
    await page.goto('/fr/sign-up');
    await hydrated(page);
    await expect
      .poll(() => page.frames().some((frame) => frame.url().startsWith(CHALLENGES)))
      .toBe(true);
    await fillSignUp(page, freshEmail('turnstile-pass'));
    await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse' })).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  test('a failed challenge stops the sign-up and says so', async ({ page }) => {
    const violations = await watchCsp(page);
    // The page as the api would configure it with the test key that always fails.
    await page.route(/\/fr\/sign-up$/, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replaceAll(PASSING_SITE_KEY, FAILING_SITE_KEY);
      await route.fulfill({ response, body });
    });
    await page.goto('/fr/sign-up');
    await hydrated(page);
    await expect(page.getByText('La vérification anti-spam n’a pas pu se charger.')).toBeVisible({
      timeout: 30_000,
    });
    await fillSignUp(page, freshEmail('turnstile-fail'));
    await expect(
      page.getByText(
        "La vérification anti-spam n'a pas pu se faire. Rechargez la page et réessayez.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/fr\/sign-up$/);
    expect(await violations()).toEqual([]);
  });
});
