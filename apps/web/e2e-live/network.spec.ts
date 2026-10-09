import { expect, test } from '@playwright/test';
import { hydrated, memberPage } from './support';

/**
 * The network against the real api (§10.2): two members in their own browser contexts, the
 * request with its note, its acceptance from the network page, the follow, the block.
 */
test.describe('network', { tag: '@critical' }, () => {
  test('a request with its note is accepted from the invitations of the network', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'net-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'net-b', { name: 'Bakary Traoré' });

    await a.page.goto(`/fr/members/${b.member.handle}`);
    await hydrated(a.page);
    await a.page.getByRole('button', { name: 'Se connecter avec Bakary Traoré' }).click();
    const dialog = a.page.getByRole('dialog', { name: 'Se connecter avec Bakary Traoré' });
    await dialog.getByLabel('Note').fill('Nous nous sommes croisés au forum de Dakar.');
    await dialog.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(
      a.page.getByRole('button', { name: /Demande envoyée à Bakary Traoré/ }),
    ).toBeVisible();

    await b.page.goto('/fr/network');
    await hydrated(b.page);
    await expect(b.page.getByRole('tab', { name: /Invitations\s*1/ })).toBeVisible();
    await expect(b.page.getByText('Nous nous sommes croisés au forum de Dakar.')).toBeVisible();
    await b.page.getByRole('button', { name: 'Accepter Awa Diallo' }).click();
    await expect(b.page.getByText('Vous êtes connectés avec Awa Diallo.').first()).toBeVisible();

    await a.page.reload();
    await expect(
      a.page.getByRole('button', { name: /En relation avec Bakary Traoré/ }),
    ).toBeVisible();
    await a.page.goto('/fr/network?view=lists');
    await expect(
      a.page.getByRole('list', { name: 'Connexions' }).getByText('Bakary Traoré'),
    ).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('a pending request is withdrawn, a follow kept after a reload', async ({ browser }) => {
    const a = await memberPage(browser, 'net-withdraw', { name: 'Awa Diallo' });
    const c = await memberPage(browser, 'net-c', { name: 'Chidi Okeke' });
    await a.page.goto(`/fr/members/${c.member.handle}`);
    await hydrated(a.page);
    await a.page.getByRole('button', { name: 'Se connecter avec Chidi Okeke' }).click();
    await a.page.getByRole('dialog').getByRole('button', { name: 'Envoyer la demande' }).click();
    await a.page.getByRole('button', { name: /Demande envoyée à Chidi Okeke/ }).click();
    await a.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Retirer la demande' })
      .click();
    await expect(
      a.page.getByRole('button', { name: 'Se connecter avec Chidi Okeke' }),
    ).toBeVisible();

    const follow = a.page.getByRole('button', { name: 'Suivre Chidi Okeke' });
    await follow.click();
    await expect(
      a.page.getByRole('button', { name: 'Ne plus suivre Chidi Okeke' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await a.page.reload();
    await expect(a.page.getByRole('button', { name: 'Ne plus suivre Chidi Okeke' })).toBeVisible();
    await a.context.close();
    await c.context.close();
  });

  test('a refused follow comes back at once to its previous state', async ({ browser }) => {
    const a = await memberPage(browser, 'net-rollback', { name: 'Awa Diallo' });
    const d = await memberPage(browser, 'net-d', { name: 'Didier Kamga' });
    await a.page.goto(`/fr/members/${d.member.handle}`);
    await hydrated(a.page);
    await a.page.route('**/v1/network/follows/member/**', (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 503, title: 'Unavailable', code: 'INTERNAL_ERROR' }),
          })
        : route.continue(),
    );
    await a.page.getByRole('button', { name: 'Suivre Didier Kamga' }).click();
    await expect(a.page.getByRole('button', { name: 'Suivre Didier Kamga' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await a.context.close();
    await d.context.close();
  });

  test('a blocked member disappears, then comes back once unblocked', async ({ browser }) => {
    const a = await memberPage(browser, 'net-block', { name: 'Awa Diallo' });
    const e = await memberPage(browser, 'net-e', { name: 'Esther Mbala' });
    await a.page.goto(`/fr/members/${e.member.handle}`);
    await hydrated(a.page);
    await a.page.getByRole('button', { name: 'Plus d’actions pour Esther Mbala' }).click();
    await a.page.getByRole('menuitem', { name: 'Bloquer' }).click();
    await a.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Bloquer Esther Mbala' })
      .click();
    await expect(a.page).toHaveURL(/\/fr\/feed/);
    expect((await a.page.goto(`/fr/members/${e.member.handle}`))?.status()).toBe(404);

    await a.page.goto('/fr/settings/privacy');
    await hydrated(a.page);
    const blocked = a.page.getByRole('list', { name: 'Membres bloqués' });
    await expect(blocked.getByText('Esther Mbala')).toBeVisible();
    await blocked.getByRole('button', { name: 'Débloquer' }).click();
    await a.page.getByRole('alertdialog').getByRole('button', { name: 'Débloquer' }).click();
    await expect(a.page.getByText('Vous n’avez bloqué personne.')).toBeVisible();
    expect((await a.page.goto(`/fr/members/${e.member.handle}`))?.status()).toBe(200);
    await a.context.close();
    await e.context.close();
  });
});

test('a visit appears for the visited member, anonymous when private', async ({ browser }) => {
  test.setTimeout(180_000);
  const a = await memberPage(browser, 'views-a', { name: 'Awa Diallo' });
  const f = await memberPage(browser, 'views-f', { name: 'Fanta Keïta' });
  await f.page.goto('/fr/settings/privacy');
  await hydrated(f.page);
  const saved = f.page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith('/v1/me/network/settings'),
  );
  await f.page.getByRole('switch', { name: 'Visites privées' }).click();
  expect((await saved).ok()).toBe(true);
  await f.page.goto(`/fr/members/${a.member.handle}`);
  await expect(f.page.getByRole('heading', { level: 1, name: 'Awa Diallo' })).toBeVisible();

  // The worker writes the buffered visits every minute.
  await expect
    .poll(
      async () => {
        await a.page.goto('/fr/network/profile-views');
        // The list is read by the browser: counted once loaded, or once said empty.
        await expect(
          a.page
            .getByRole('list', { name: 'Visites, les plus récentes d’abord' })
            .or(a.page.getByText('Aucune visite sur la période conservée.')),
        ).toBeVisible();
        return a.page.getByText('Un membre de Pitchorium').count();
      },
      { timeout: 150_000, intervals: [10_000] },
    )
    .toBeGreaterThan(0);
  await expect(a.page.getByText('Fanta Keïta')).toHaveCount(0);
  await a.context.close();
  await f.context.close();
});
