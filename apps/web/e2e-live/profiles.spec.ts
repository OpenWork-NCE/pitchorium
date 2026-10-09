import { allowConsole, api, choose, expect, hydrated, memberPage, pngImage, test } from './support';

/** The profile of a member against the real api (§10.1). */
test.describe('profiles', () => {
  test(
    'the owner edits the head of the page and adds the entrepreneur facet',
    { tag: '@critical' },
    async ({ browser }) => {
      const { page, member, context } = await memberPage(browser, 'profile-edit', {
        name: 'Grace Wanjiru',
      });
      await page.goto(`/fr/members/${member.handle}`);
      await hydrated(page);
      await page
        .getByRole('button', { name: 'Modifier le nom, le titre et les coordonnées' })
        .click();
      const intro = page.getByRole('dialog', { name: 'Nom, titre et coordonnées' });
      await intro.getByRole('textbox', { name: /^Titre/ }).fill('Fondatrice de Maji Safi');
      await intro.getByLabel('Ville').fill('Nairobi');
      await intro.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(intro).toBeHidden();
      await expect(page.getByText('Fondatrice de Maji Safi')).toBeVisible();

      await page.getByRole('button', { name: 'Ajouter le volet entrepreneur' }).first().click();
      const facet = page.getByRole('dialog', { name: 'Ajouter le volet entrepreneur' });
      await facet.getByRole('textbox', { name: 'Entreprise' }).fill('Maji Safi');
      await choose(facet, 'Secteur', /^Production et distribution d'électricité/, 'électricité');
      await choose(facet, 'Stade', 'Idée');
      await choose(facet, 'Pays de l’entreprise', 'Kenya', 'Kenya');
      await facet.getByRole('button', { name: 'Ajouter le volet' }).click();
      await expect(facet).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Volet entrepreneur' })).toBeVisible();
      await expect(page.getByText('Maji Safi', { exact: true })).toBeVisible();
      await context.close();
    },
  );

  test('a photo is framed in the browser, sent, checked, then shown', async ({ browser }) => {
    test.setTimeout(180_000);
    const { page, member, context } = await memberPage(browser, 'profile-photo');
    await page.goto(`/fr/members/${member.handle}`);
    await hydrated(page);
    await page.getByRole('button', { name: 'Changer la photo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Photo de profil' });
    await dialog.locator('input[type="file"]').setInputFiles(await pngImage(page, 640, 480));
    await expect(dialog.locator('[data-crop-area]')).toBeVisible();
    await dialog.getByRole('button', { name: 'Enregistrer l’image' }).click();
    // Sent with its progress, then checked by the worker, then attached.
    await expect(dialog).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('[data-profile-header] img').first()).toBeVisible();
    await context.close();
  });

  test('a new handle redirects from the former one', async ({ browser }) => {
    const { page, member, context } = await memberPage(browser, 'profile-handle');
    const next = `${member.handle.slice(0, 20)}-nouveau`;
    await page.goto(`/fr/members/${member.handle}`);
    await hydrated(page);
    await page.getByRole('button', { name: 'Changer l’adresse du profil' }).click();
    const dialog = page.getByRole('dialog', { name: 'Adresse du profil' });
    await dialog.getByLabel('Identifiant public').fill(next);
    await expect(dialog.getByText('Vos liens restent valables')).toBeVisible();
    await dialog.getByRole('button', { name: 'Changer l’adresse' }).click();
    await expect(page).toHaveURL(new RegExp(`/fr/members/${next}$`));
    await page.goto(`/fr/members/${member.handle}`);
    await expect(page).toHaveURL(new RegExp(`/fr/members/${next}$`));
    await context.close();
  });

  test(
    'the public page is closed to visitors until its owner opens it',
    { tag: '@critical' },
    async ({ browser }) => {
      // The closed page is opened by a visitor on purpose.
      allowConsole(/status of 404 \(Not Found\)/);
      const { page, member, context } = await memberPage(browser, 'profile-public', {
        name: 'Ines Mbeki',
      });
      const visitor = await browser.newContext();
      const anonymous = await visitor.newPage();
      expect((await anonymous.goto(`/fr/members/${member.handle}`))?.status()).toBe(404);

      await page.goto('/fr/settings/privacy');
      await hydrated(page);
      await page.getByRole('switch', { name: 'Page publique' }).click();
      await expect(page.getByRole('switch', { name: 'Page publique' })).toBeChecked();
      // Saved by the api before a visitor reads it.
      await expect
        .poll(async () => {
          const own = (await (await api(page, 'GET', '/v1/me/profile')).json()) as {
            visibility: { publicPageEnabled: boolean };
          };
          return own.visibility.publicPageEnabled;
        })
        .toBe(true);

      const response = await anonymous.goto(`/fr/members/${member.handle}`);
      expect(response?.status()).toBe(200);
      await expect(anonymous.getByRole('heading', { level: 1, name: 'Ines Mbeki' })).toBeVisible();
      await expect(anonymous.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/);
      await expect(
        anonymous.getByRole('link', { name: 'Se connecter pour échanger' }),
      ).toBeVisible();
      await visitor.close();
      await context.close();
    },
  );
});
