import { expect, test } from '@playwright/test';
import { acceptTerms, freshEmail, hydrated, signUpAndVerify } from './support';

/** Critical journeys: Chromium, Firefox and WebKit (playwright.live.config.ts). */
test.describe('sign-up and onboarding', { tag: '@critical' }, () => {
  test('email sign-up, verification, terms, intention, minimum profile, then the feed', async ({
    page,
  }) => {
    const email = freshEmail('signup');
    await signUpAndVerify(page, email);
    await page.getByRole('link', { name: 'Continuer' }).click();
    await acceptTerms(page);

    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
    await hydrated(page);
    await page.getByRole('radio', { name: /Je porte un projet/ }).check();
    await page.getByRole('button', { name: 'Continuer' }).click();

    await expect(page.getByRole('heading', { name: 'Votre profil' })).toBeVisible();
    await hydrated(page);
    const strength = page.getByRole('progressbar', { name: 'Force du profil' });
    const before = Number(await strength.getAttribute('aria-valuenow'));
    await page.getByLabel('Titre').fill('Fondatrice d’une coopérative de karité');
    await page.getByLabel('Titre').blur();
    await expect
      .poll(async () => Number(await strength.getAttribute('aria-valuenow')))
      .toBeGreaterThan(before);
    await page.getByRole('button', { name: 'Entrer dans Pitchorium' }).click();

    await expect(page).toHaveURL(/\/fr\/feed$/);
    await expect(page.getByRole('heading', { name: 'Accueil' })).toBeAttached();
  });

  test('onboarding entirely skipped: the terms only, then the feed', async ({ page }) => {
    await signUpAndVerify(page, freshEmail('skip'));
    await page.getByRole('link', { name: 'Continuer' }).click();
    await acceptTerms(page);
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
    await hydrated(page);
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Votre profil' })).toBeVisible();
    await hydrated(page);
    await page.getByRole('button', { name: 'Passer', exact: true }).click();
    await expect(page).toHaveURL(/\/fr\/feed$/);
  });

  test('the terms cannot be skipped: a sign-in lands on them first', async ({ page }) => {
    await signUpAndVerify(page, freshEmail('terms'));
    await page.goto('/fr/feed');
    await page.goto('/fr/continue?redirectTo=%2Ffr%2Ffeed');
    await expect(page).toHaveURL(/\/fr\/onboarding\/terms\?redirectTo=%2Ffr%2Ffeed/);
    await hydrated(page);
    await page.getByRole('button', { name: 'Accepter et continuer' }).click();
    await expect(page.getByText('Le formulaire contient 3 erreurs.')).toBeVisible();
  });
});
