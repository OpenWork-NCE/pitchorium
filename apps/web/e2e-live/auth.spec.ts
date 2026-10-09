import {
  allowConsole,
  API_URL,
  expect,
  forgetSession,
  freshEmail,
  hydrated,
  linkFromInbox,
  onboardedMember,
  PASSWORD,
  signInWithPassword,
  signUpAndVerify,
  test,
  totp,
} from './support';

/** Critical journeys: Chromium, Firefox and WebKit (playwright.live.config.ts). */
test.describe('authentication', { tag: '@critical' }, () => {
  test('magic link: a new address gets an account and starts the onboarding', async ({ page }) => {
    const email = freshEmail('magic');
    await page.goto('/fr/sign-in/email');
    await hydrated(page);
    await page.getByLabel('Adresse email').fill(email);
    await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
    await expect(page.getByRole('heading', { name: 'Lien envoyé' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Renvoyer dans \d+ s/ })).toBeDisabled();
    await page.goto(
      await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/magic-link\/verify[^\s"<>]*/),
    );
    await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible();
  });

  test('sign out from the account menu, then back in with a magic link', async ({ page }) => {
    const email = await onboardedMember(page, 'back');
    await hydrated(page);
    await page.getByRole('button', { name: /Compte de/ }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await expect(page).toHaveURL(/\/fr$/);
    await page.goto('/fr/sign-in/email');
    await hydrated(page);
    await page.getByLabel('Adresse email').fill(email);
    await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
    await expect(page.getByRole('heading', { name: 'Lien envoyé' })).toBeVisible();
    await page.goto(
      await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/magic-link\/verify[^\s"<>]*/),
    );
    await expect(page).toHaveURL(/\/fr\/feed$/);
  });

  test('sign out of every device from the security settings', async ({ page, browser }) => {
    const email = await onboardedMember(page, 'everywhere');
    const other = await browser.newContext();
    const second = await other.newPage();
    await signInWithPassword(second, email);
    await expect(second).toHaveURL(/\/fr\/feed$/);
    await page.goto('/fr/settings/security');
    await hydrated(page);
    await page.getByRole('button', { name: 'Se déconnecter partout, y compris ici' }).click();
    await expect(page).toHaveURL(/\/fr$/);
    await second.goto('/fr/settings/account');
    await expect(second).toHaveURL(/\/fr\/sign-in/);
    await other.close();
  });

  test('password reset: a link by email, a new password, then a sign-in with it', async ({
    page,
  }) => {
    const email = await onboardedMember(page, 'reset');
    await forgetSession(page);
    await page.goto('/fr/forgot-password');
    await hydrated(page);
    await page.getByLabel('Adresse email').fill(email);
    await page.getByRole('button', { name: 'Recevoir le lien' }).click();
    await expect(page.getByRole('heading', { name: 'Consultez vos emails' })).toBeVisible();
    await page.goto(
      await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/reset-password\/[^\s"<>]*/),
    );
    await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();
    await hydrated(page);
    await page.getByRole('textbox', { name: 'Nouveau mot de passe' }).fill(`${PASSWORD} again`);
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
    await expect(page.getByRole('heading', { name: 'Mot de passe modifié' })).toBeVisible();
    await signInWithPassword(page, email, `${PASSWORD} again`);
    await expect(page).toHaveURL(/\/fr\/feed$/);
  });

  test('two-factor: turned on, then a sign-in with a code, then with a backup code', async ({
    page,
  }) => {
    const email = await onboardedMember(page, 'totp');
    await page.goto('/fr/settings/security');
    await hydrated(page);
    await page.getByRole('button', { name: 'Activer la double authentification' }).click();
    await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Continuer' }).click();
    await expect(
      page.getByRole('img', { name: 'QR code de la double authentification' }),
    ).toBeVisible();
    const secret = (await page.locator('code').first().textContent())!.trim();
    await page.getByRole('textbox', { name: 'Code de l’application' }).fill(await totp(secret));
    await expect(page.getByText('Double authentification activée.')).toBeVisible();
    const backupCode = (await page.locator('ul.font-mono li').first().textContent())!.trim();

    await forgetSession(page);
    await signInWithPassword(page, email);
    await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
    await hydrated(page);
    // A code of the next window: the one used to turn it on cannot be used twice.
    await page
      .getByRole('textbox', { name: 'Code de l’application' })
      .fill(await totp(secret, Date.now() + 30_000));
    await expect(page).toHaveURL(/\/fr\/feed$/);

    await forgetSession(page);
    await signInWithPassword(page, email);
    await expect(page.getByRole('heading', { name: 'Double authentification' })).toBeVisible();
    await hydrated(page);
    await page.getByRole('button', { name: 'Utiliser un code de secours' }).click();
    await page.getByRole('textbox', { name: 'Code de secours' }).fill(backupCode);
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(page).toHaveURL(/\/fr\/feed$/);
  });

  test('sessions: one revoked from another browser is signed out', async ({ page, browser }) => {
    // The revoked browser still signals the views of its feed once: refused, as it should be.
    allowConsole(/status of 401 \(Unauthorized\) \(\S+\/v1\/posts\/views/);
    const email = await onboardedMember(page, 'sessions');
    const other = await browser.newContext();
    const second = await other.newPage();
    await signInWithPassword(second, email);
    await expect(second).toHaveURL(/\/fr\/feed$/);

    await page.goto('/fr/settings/security');
    await hydrated(page);
    await expect(page.getByText('Cet appareil', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Fermer', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Fermer', exact: true })).toHaveCount(0);

    await second.goto('/fr/settings/account');
    await expect(second).toHaveURL(/\/fr\/sign-in/);
    await other.close();
  });

  test('the last sign-in method cannot be removed, and the reason is given', async ({ page }) => {
    await onboardedMember(page, 'methods');
    await page.goto('/fr/settings/account');
    await expect(page.getByText('Email et mot de passe')).toBeVisible();
    await expect(page.getByText('Seule méthode', { exact: true })).toBeVisible();
    await expect(page.getByText(/C’est votre seule méthode de connexion/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Retirer/ })).toHaveCount(0);
  });

  test('an open redirect is refused: the feed instead of another origin', async ({ page }) => {
    await onboardedMember(page, 'redirect');
    for (const target of ['https://evil.example/fr/feed', '//evil.example', '/\\evil.example']) {
      await page.goto(`/fr/continue?redirectTo=${encodeURIComponent(target)}`);
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/fr\/feed$/);
    }
    await page.goto(`/fr/continue?redirectTo=${encodeURIComponent('/fr/settings/security')}`);
    await expect(page).toHaveURL(/\/fr\/settings\/security$/);
  });

  test('a missing prerequisite opens its form, then the action runs again', async ({ page }) => {
    // Without the terms the api refuses the feed and the counters on purpose.
    allowConsole(/status of 403 \(Forbidden\)/);
    // Without the terms the api refuses the feed: the retry opens their form, then reloads.
    await signUpAndVerify(page, freshEmail('gate'));
    await page.goto('/fr/feed');
    await hydrated(page);
    await expect(
      page.getByRole('heading', { name: 'Le fil n’a pas pu se charger.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Réessayer' }).click();
    const dialog = page.getByRole('dialog', { name: /À compléter/ });
    await expect(dialog).toBeVisible();
    for (const name of [
      /conditions d’utilisation/,
      /politique de confidentialité/,
      /au moins 18 ans/,
    ]) {
      await dialog.getByRole('checkbox', { name }).check();
    }
    await dialog.getByRole('button', { name: 'Accepter et continuer' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Le fil n’a pas pu se charger.' })).toBeHidden();
    await expect(page.getByRole('article').first()).toBeVisible();
  });

  test('a rate limit is shown with its delay', async ({ page, browserName }) => {
    // Wrong passwords, then the limit: refusals on purpose.
    allowConsole(/status of (401|429) .*\/v1\/auth\/sign-in\/email/);
    test.skip(browserName !== 'chromium', 'One engine: the limit is per address and per minute.');
    test.slow();
    const email = freshEmail('limit');
    await page.goto('/fr/sign-in/password');
    await hydrated(page);
    // The attempts that use up the limit go straight to the api (each screen submit waits for
    // a new Turnstile challenge), from the page: the limit counts per address of the client, the
    // one of the browser (localhost may resolve to another address for a request of Node).
    await expect(async () => {
      const status = await page.evaluate(
        async ({ url, address }) =>
          (
            await fetch(`${url}/v1/auth/sign-in/email`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'content-type': 'application/json',
                'x-captcha-response': 'XXXX.DUMMY.TOKEN.XXXX',
              },
              body: JSON.stringify({ email: address, password: 'not the password at all' }),
            })
          ).status,
        { url: API_URL, address: email },
      );
      expect(status).toBe(429);
    }).toPass({ timeout: 60_000, intervals: [0] });
    await page.getByLabel('Adresse email').fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).fill('not the password at all');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(
      page.getByText(/Trop de tentatives\. Réessayez dans \d+ secondes\./),
    ).toBeVisible();
    // The window of the limit ends before the next journeys sign in.
    await page.waitForTimeout(61_000);
  });
});
