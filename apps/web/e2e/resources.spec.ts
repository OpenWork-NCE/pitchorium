import { allowConsole, expect, signIn, test } from './support/fixtures';

const AISSATOU = 'aissatou.ba@demo.pitchorium.test';

/** One address per resource, for visitors and members (ADR 0101). */
test.describe('pages of resources', () => {
  test('shows a public project to a visitor, indexable, in the public shell', async ({ page }) => {
    const response = await page.goto('/fr/projects/ferme-solaire-thies');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Ferme solaire coopérative de Thiès' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/fr\/projects\/ferme-solaire-thies$/,
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/);
  });

  test('answers 404 to a visitor for a resource that is not public', async ({ page }) => {
    allowConsole(/status of 404 \(Not Found\)/);
    const response = await page.goto('/fr/projects/projet-en-preparation');
    expect(response?.status()).toBe(404);
  });

  test('shows the same address to a member allowed to read it, in the member shell', async ({
    page,
  }) => {
    await signIn(page, AISSATOU);
    const response = await page.goto('/fr/projects/projet-en-preparation');
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Séchoirs solaires de Podor' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('keeps the showcase public, and sends Profil to the page of the member', async ({
    page,
  }) => {
    const showcase = await page.goto('/fr/projects');
    expect(showcase?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/);
    await signIn(page, AISSATOU);
    await page.goto('/fr/profile');
    await expect(page).toHaveURL(/\/fr\/members\/aissatou-ba$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Aïssatou Ba' })).toBeVisible();
  });
});

/** Profiles and organisations (§10.1, §10.7): the view follows the reader (ADR 0113). */
test.describe('profiles and organisations', () => {
  test('gives a visitor the public page of a member, indexable, with its Person', async ({
    page,
  }) => {
    const response = await page.goto('/fr/members/aissatou-ba');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/);
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(data).toMatchObject({ '@type': 'Person', name: 'Aïssatou Ba' });
    await expect(page.getByRole('link', { name: 'Se connecter pour échanger' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Se connecter avec/ })).toHaveCount(0);
    // A closed public page is absent for a visitor: a 404 on purpose.
    allowConsole(/status of 404 \(Not Found\)/);
    expect((await page.goto('/fr/members/kofi-mensah'))?.status()).toBe(404);
  });

  test('gives a visitor the lists of a member rendered by the server, as links', async ({
    page,
  }) => {
    await page.goto('/fr/members/aissatou-ba/network');
    const lists = page.getByRole('navigation', { name: 'Réseau de Aïssatou Ba' });
    await expect(lists.getByRole('link', { name: 'Connexions' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByText('Aucune connexion à afficher.')).toBeVisible();
    await lists.getByRole('link', { name: 'Abonnements' }).click();
    await expect(page).toHaveURL(/\?tab=following$/);
    await expect(page.getByRole('navigation', { name: 'Type d’abonnement' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('gives a member the member view, never indexed, with the relationship', async ({ page }) => {
    await signIn(page, 'claudine.pierre.louis@demo.pitchorium.test');
    await page.goto('/fr/members/aissatou-ba');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Se connecter avec Aïssatou Ba' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Suivre Aïssatou Ba' })).toBeVisible();
    await expect(page.getByText('3 connexions en commun')).toBeVisible();
    // No message nor report before their prompts.
    await expect(page.getByRole('button', { name: /Message|Signaler/ })).toHaveCount(0);
  });

  test('lets the owner edit their page and see who viewed it', async ({ page }) => {
    await signIn(page, 'aissatou.ba@demo.pitchorium.test');
    await page.goto('/fr/members/aissatou-ba');
    await expect(page.getByRole('heading', { name: 'Force du profil' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qui a consulté votre profil' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Modifier le nom, le titre et les coordonnées' }),
    ).toBeVisible();
  });

  test('shows an organisation with its Organization to a visitor', async ({ page }) => {
    const response = await page.goto('/fr/organizations/fondation-teranga');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Fondation Teranga' })).toBeVisible();
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(data).toMatchObject({ '@type': 'Organization', name: 'Fondation Teranga' });
    await expect(page.getByRole('link', { name: 'Gérer' })).toHaveCount(0);
  });

  test('gives the owner of an organisation the way to its management', async ({ page }) => {
    await signIn(page, 'aissatou.ba@demo.pitchorium.test');
    await page.goto('/fr/organizations/fondation-teranga');
    await expect(page.getByRole('button', { name: 'Suivre Fondation Teranga' })).toBeVisible();
    await page.getByRole('link', { name: 'Gérer' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Gérer Fondation Teranga' }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Membres' })).toBeVisible();
  });

  test('opens the network, the visits and the privacy settings of a member', async ({ page }) => {
    await signIn(page, 'aissatou.ba@demo.pitchorium.test');
    await page.goto('/fr/network');
    await expect(page.getByRole('heading', { level: 1, name: 'Réseau' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Invitations/ })).toBeVisible();
    await page.goto('/fr/network/profile-views');
    await expect(page.getByText('Les visites sont conservées 90 jours.')).toBeVisible();
    await page.goto('/fr/settings/privacy');
    await expect(page.getByRole('switch', { name: 'Page publique' })).toBeChecked();
    await expect(page.getByText('Vous n’avez bloqué personne.')).toBeVisible();
  });
});
