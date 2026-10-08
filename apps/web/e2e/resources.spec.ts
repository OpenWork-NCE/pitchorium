import { expect, signIn, test } from './support/fixtures';

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
