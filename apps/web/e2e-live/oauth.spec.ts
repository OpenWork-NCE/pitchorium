import { type Page } from '@playwright/test';
import {
  acceptTerms,
  apiMember,
  consentAs,
  expect,
  freshEmail,
  hydrated,
  test,
  totp,
} from './support';

/**
 * Sign-in with a provider against the real api (A2): the fake providers stand in for Google in the
 * browser (its consent page) and on the server (its token endpoint), with the linking policy of
 * ADR 0014. A4: an account without a password turns the second factor on (ADR 0108).
 */
test.describe('sign-in with Google', { tag: '@critical' }, () => {
  async function continueWithGoogle(page: Page) {
    await page.goto('/fr/sign-in');
    await hydrated(page);
    await page.getByRole('button', { name: 'Continuer avec Google' }).click();
  }

  test('a new address gets an account, then the onboarding', async ({ page }) => {
    const email = freshEmail('google-new');
    await consentAs(page, 'google', {
      subject: `google-${email}`,
      email,
      emailVerified: true,
      name: 'Ama Owusu',
    });
    await continueWithGoogle(page);
    await acceptTerms(page);
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
  });

  test('an account whose address is verified on both sides is linked at once', async ({
    page,
    browser,
  }) => {
    const member = await apiMember(page, 'google-link');
    const other = await browser.newPage();
    await consentAs(other, 'google', {
      subject: `google-${member.email}`,
      email: member.email,
      emailVerified: true,
      name: member.name,
    });
    await continueWithGoogle(other);
    await expect(other).toHaveURL(/\/fr\/feed$/);
    await other.goto('/fr/settings/account');
    await expect(other.getByRole('button', { name: 'Retirer Google' })).toBeVisible();
    await other.close();
  });

  test('an account whose address is not verified is never linked', async ({ page, browser }) => {
    const member = await apiMember(page, 'google-unlinkable', { verified: false });
    const other = await browser.newPage();
    await consentAs(other, 'google', {
      subject: `google-${member.email}`,
      email: member.email,
      emailVerified: true,
      name: 'Quelqu’un d’autre',
    });
    await continueWithGoogle(other);
    await expect(
      other.getByRole('heading', { name: 'Cette adresse a déjà un compte' }),
    ).toBeVisible();
    await expect(
      other.getByRole('link', { name: 'Se connecter, puis relier le compte' }),
    ).toBeVisible();
    await other.close();
  });

  test('an address the provider has not verified stays to verify', async ({ page }) => {
    const email = freshEmail('google-unverified');
    await consentAs(page, 'google', {
      subject: `google-${email}`,
      email,
      emailVerified: false,
      name: 'Kwame Asante',
    });
    await continueWithGoogle(page);
    await acceptTerms(page);
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
    await page.goto('/fr/feed');
    await expect(page.getByText(`Vérifiez votre adresse ${email}`)).toBeVisible();
  });

  test('an account without a password turns the second factor on, then is asked for it', async ({
    page,
    browser,
  }) => {
    const email = freshEmail('google-2fa');
    const identity = {
      subject: `google-${email}`,
      email,
      emailVerified: true,
      name: 'Fatou Ndiaye',
    };
    await consentAs(page, 'google', identity);
    await continueWithGoogle(page);
    await acceptTerms(page);
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();

    await page.goto('/fr/settings/security');
    await hydrated(page);
    await expect(page.getByText('Votre compte n’a pas de mot de passe')).toBeVisible();
    await page.getByRole('button', { name: 'Activer la double authentification' }).click();
    await expect(
      page.getByRole('img', { name: 'QR code de la double authentification' }),
    ).toBeVisible();
    const secret = (await page.locator('code').first().textContent())!.trim();
    await page.getByRole('textbox', { name: 'Code de l’application' }).fill(await totp(secret));
    await expect(page.getByText('Double authentification activée.')).toBeVisible();

    // Another browser: Google alone no longer opens the session, the code does.
    const other = await browser.newPage();
    await consentAs(other, 'google', identity);
    await continueWithGoogle(other);
    await expect(other).toHaveURL(/\/fr\/sign-in\/two-factor/);
    await hydrated(other);
    await other
      .getByRole('textbox', { name: 'Code de l’application' })
      .fill(await totp(secret, Date.now() + 30_000));
    await expect(other).toHaveURL(/\/fr\/feed$/);
    await other.close();
  });
});
