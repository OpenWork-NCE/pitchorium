import { expect, hydrated, memberPage, ok, api, test } from './support';

/**
 * The charts (PROMPT FRONT 6, part A, ADR 0144) against the real api, in their empty states: a
 * member without contribution reads why the dashboard is empty and where to go, the author of a
 * publication nobody saw reads it in its statistics. The full charts are checked by the journey
 * of a contribution (payments.spec.ts) and by the review captures.
 */
test.describe('charts', () => {
  test('the dashboard and the statistics say their empty states with an action', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'chart-a', { name: 'Awa Diallo' });
    await a.page.goto('/fr/dashboard');
    await hydrated(a.page);
    await expect(
      a.page.getByRole('heading', { name: 'Aucune contribution sur les 12 derniers mois' }),
    ).toBeVisible();
    await expect(a.page.getByRole('link', { name: 'Découvrir des projets' })).toBeVisible();

    const post = (await (
      await ok(
        api(a.page, 'POST', '/v1/posts', {
          text: 'Une publication nouvelle.',
          visibility: 'members',
        }),
      )
    ).json()) as { id: string };
    await a.page.goto(`/fr/posts/${post.id}`);
    await hydrated(a.page);
    await a.page.getByRole('button', { name: 'Plus d’actions' }).first().click();
    await a.page.getByRole('menuitem', { name: 'Statistiques' }).click();
    const dialog = a.page.getByRole('dialog', { name: 'Statistiques de la publication' });
    await expect(dialog.getByText('Personne ne l’a encore vue.')).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Copier le lien de la publication' }),
    ).toBeVisible();
    await a.context.close();
  });
});
