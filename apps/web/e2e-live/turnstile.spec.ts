import { type Page } from '@playwright/test';
import {
  allowConsole,
  expect,
  FAKE_OAUTH_URL,
  freshEmail,
  hydrated,
  LOCAL_TURNSTILE,
  PASSWORD,
  test,
} from './support';

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
 * They depend on Cloudflare (`@external`): level 3 runs them in their own job, with one retry
 * allowed and a report of their own, so that an outage of Cloudflare is never counted as a
 * flaky test of Pitchorium (ADR 0127).
 */
test.describe('Cloudflare Turnstile', { tag: '@external' }, () => {
  test.skip(LOCAL_TURNSTILE, 'The run uses the local stand-in of Turnstile (ADR 0143).');

  test(
    'a passed challenge lets the sign-up through, without any CSP violation',
    { tag: '@critical' },
    async ({ page }) => {
      const violations = await watchCsp(page);
      await page.goto('/fr/sign-up');
      await hydrated(page);
      await expect
        .poll(() => page.frames().some((frame) => frame.url().startsWith(CHALLENGES)))
        .toBe(true);
      await fillSignUp(page, freshEmail('turnstile-pass'));
      await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse' })).toBeVisible();
      expect(await violations()).toEqual([]);
    },
  );

  test('a failed challenge stops the sign-up and says so', async ({ page }) => {
    // The challenge fails on purpose: its frame reports it.
    allowConsole(
      /Failed to load resource.*challenges\.cloudflare\.com|status of 4\d\d .*\/v1\/auth\//,
    );
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

/** Verifications the local siteverify answered so far (test/turnstile/local-turnstile.ts). */
async function localVerifications(): Promise<number> {
  const response = await fetch(`${FAKE_OAUTH_URL}/turnstile/siteverify`);
  return ((await response.json()) as { verifications: number }).verifications;
}

/**
 * The local stand-in of Turnstile (ADR 0143), the one of level 2: the same contract as
 * Cloudflare for the page (widget script named by the api, token in the header) and for the api
 * (siteverify), without any request to Cloudflare (the `noCloudflare` fixture fails on one).
 */
test.describe('local stand-in of Turnstile', () => {
  test.skip(!LOCAL_TURNSTILE, 'Runs with LIVE_TURNSTILE=local only.');

  test(
    'a passed local challenge lets the sign-up through, verified by the local siteverify',
    { tag: '@critical' },
    async ({ page }) => {
      const violations = await watchCsp(page);
      await page.goto('/fr/sign-up');
      await hydrated(page);
      await expect(page.locator('[data-local-turnstile]')).toBeAttached();
      const before = await localVerifications();
      await fillSignUp(page, freshEmail('turnstile-local'));
      await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse' })).toBeVisible();
      expect(await localVerifications()).toBeGreaterThan(before);
      expect(page.frames().some((frame) => frame.url().startsWith(CHALLENGES))).toBe(false);
      expect(await violations()).toEqual([]);
    },
  );
});
