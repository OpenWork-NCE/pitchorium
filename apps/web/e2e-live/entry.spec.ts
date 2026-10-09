import { expect, forgetSession, freshEmail, hydrated, onboardedMember, test } from './support';

/** Critical journeys: Chromium, Firefox and WebKit (playwright.live.config.ts). */
test.describe('entry of the authentication', { tag: '@critical' }, () => {
  const API_URL = process.env.LIVE_API_URL ?? 'http://localhost:3100';

  test('the email step: a link by default, a password on request, the same answer for any address', async ({
    page,
  }) => {
    const known = await onboardedMember(page, 'entry');
    await forgetSession(page);
    const answers: string[] = [];
    for (const email of [known, freshEmail('unknown')]) {
      await page.goto('/fr/sign-in');
      await hydrated(page);
      // A provider is configured (the fake Google): the email step is one choice of the entry.
      await expect(page.getByRole('heading', { name: 'Rejoindre Pitchorium' })).toBeVisible();
      await page.getByRole('link', { name: 'Continuer avec un email' }).click();
      await expect(page).toHaveURL(/\/fr\/sign-in\/email$/);
      await hydrated(page);
      await expect(page.getByRole('link', { name: 'Utiliser un mot de passe' })).toBeVisible();
      await page.getByLabel('Adresse email').fill(email);
      await page.getByRole('button', { name: 'Recevoir un lien de connexion' }).click();
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toHaveText('Lien envoyé');
      answers.push(
        (await page.getByRole('main').innerText()).replace(email, '<adresse>').replace(/\d+ s/, ''),
      );
    }
    expect(answers[0]).toBe(answers[1]);
    await page.goto('/fr/sign-in/email');
    await hydrated(page);
    await page.getByRole('link', { name: 'Utiliser un mot de passe' }).click();
    await expect(
      page.getByRole('heading', { name: 'Connexion avec un mot de passe' }),
    ).toBeVisible();
  });

  test('the api gives the precise reason of a refused field (A11)', async ({ page }) => {
    await onboardedMember(page, 'reasons');
    const origin = new URL(page.url()).origin;
    const patch = (website: string) =>
      page.request.patch(`${API_URL}/v1/me/profile`, {
        headers: { Origin: origin },
        data: { links: { website, linkedin: null } },
      });
    const malformed = await (await patch('https://exemple org')).json();
    expect(malformed.errors).toEqual([
      { pointer: '/links/website', code: 'invalid_format', reason: 'url' },
    ]);
    const plain = await (await patch('http://exemple.org')).json();
    expect(plain.errors).toEqual([
      { pointer: '/links/website', code: 'custom', reason: 'https_required' },
    ]);
    expect((await patch('https://exemple.org')).ok()).toBe(true);
  });
});
