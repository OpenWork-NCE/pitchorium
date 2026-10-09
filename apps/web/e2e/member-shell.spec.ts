import AxeBuilder from '@axe-core/playwright';
import { request as playwrightRequest } from '@playwright/test';
import { API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

const AISSATOU = 'aissatou.ba@demo.pitchorium.test';
const KOFI = 'kofi.mensah@demo.pitchorium.test';
const CLAUDINE = 'claudine.pierre.louis@demo.pitchorium.test';
const KOFFI = 'koffi.agbodjan@demo.pitchorium.test';
const MOUSSA = 'moussa.diop@demo.pitchorium.test';

// The realtime events and the log of the writes are shared by the whole stub: one at a time.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

test.describe('member shell', () => {
  test('opens with a session created by the api, header and counters included', async ({
    page,
  }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(nav.getByRole('link', { name: 'Accueil' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      nav.getByRole('link', { name: /^Messages\s?, 2 messages non lus$/ }),
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: /^Notifications\s?, 3 notifications non lues$/ }),
    ).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Votre profil' })).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Personnes pertinentes pour vous' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Publier' })).toBeVisible();
  });

  test('is usable with the keyboard alone', async ({ page }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    // From the top of the document: skip link, logo, search, the six sections, the action, the
    // account.
    const skip = page.getByRole('link', { name: 'Aller au contenu' });
    const order = [
      skip,
      page.getByRole('link', { name: 'Accueil de Pitchorium' }),
      page.getByRole('button', { name: 'Rechercher sur Pitchorium' }),
      page.getByRole('link', { name: 'Accueil', exact: true }),
      page.getByRole('link', { name: 'Réseau', exact: true }),
      page.getByRole('link', { name: 'Projets', exact: true }),
      page.getByRole('link', { name: /^Messages/ }),
      page.getByRole('link', { name: /^Notifications/ }),
      page.getByRole('link', { name: 'Profil', exact: true }),
      page.getByRole('link', { name: 'Publier', exact: true }),
      page.getByRole('button', { name: 'Compte de Aïssatou Ba' }),
    ];
    for (const target of order) {
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
    }

    // The account menu opens with Enter, Escape gives the focus back.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Profil' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Mes organisations' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Paramètres' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(order.at(-1)!).toBeFocused();

    // A section by its link, then by a shortcut; the focus moves to the new content.
    await page.getByRole('link', { name: 'Réseau', exact: true }).press('Enter');
    await expect(page).toHaveURL(/\/fr\/network$/);
    await expect(page.locator('#main')).toBeFocused();
    await page.keyboard.press('g');
    await page.keyboard.press('m');
    await expect(page).toHaveURL(/\/fr\/messages$/);

    // ? lists the shortcuts.
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Raccourcis clavier' });
    await expect(help.getByText('Aller à : Réseau')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();

    // The skip link jumps over the header to the content.
    await skip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('opens the search with Ctrl K and remembers the searches', async ({ page }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    // The shortcut answers once the page is interactive.
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Recherche globale' });
    await expect(palette.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('énergie solaire');
    await page.keyboard.press('Enter');
    await expect(palette).toBeHidden();
    await page.keyboard.press('Control+k');
    await expect(palette.getByRole('option', { name: 'énergie solaire' })).toBeVisible();
    await expect(palette.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('messages');
    await page.getByRole('option', { name: 'Aller à : Messages' }).click();
    await expect(page).toHaveURL(/\/fr\/messages$/);
  });

  test('updates the counters from a realtime event and says it', async ({ page, request }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    const notifications = page.getByRole('link', { name: /^Notifications/ });
    await expect(notifications).toHaveAccessibleName(
      /^Notifications\s?, 3 notifications non lues$/,
    );
    // The socket connects after the first render: emit until it has a listener.
    await expect
      .poll(async () => {
        const response = await stub(request).emit('counters', {
          counters: {
            notifications: 5,
            messages: { unread: 2, conversations: 1 },
            messageRequests: 0,
            invitations: { connections: 1, introductions: 0, projects: 0, organizations: 0 },
          },
        });
        return ((await response.json()) as { sockets: number }).sockets;
      })
      .toBeGreaterThan(0);
    await expect(notifications).toHaveAccessibleName(
      /^Notifications\s?, 5 notifications non lues$/,
    );
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('5 notifications non lues');
  });

  test('shows the banners of the account, the prerequisites and the reasons', async ({ page }) => {
    await signIn(page, KOFI);
    await page.goto('/fr/feed');
    await expect(page.getByText(/Les conditions d’utilisation ou la politique/)).toBeVisible();
    await expect(page.getByText(/Vérifiez votre adresse kofi\.mensah@/)).toBeVisible();
    await page.getByRole('button', { name: 'Renvoyer l’email' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Email envoyé.' })).toBeVisible();
    // Publishing needs a verified email: the action says why it is not available.
    const publish = page.getByRole('button', { name: 'Publier' });
    await expect(publish).toHaveAttribute('aria-disabled', 'true');
    await expect(publish).toHaveAccessibleDescription(
      'À compléter d’abord : acceptation des conditions et email vérifié.',
    );
  });

  test('says a suspension and the second factor a moderator needs', async ({ browser }) => {
    for (const [email, text] of [
      [MOUSSA, /Votre compte est suspendu/],
      [CLAUDINE, /Activez la double authentification/],
    ] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, email);
      await page.goto('/fr/feed');
      await expect(page.getByText(text)).toBeVisible();
      await context.close();
    }
  });

  test('acts on a suggestion: connect, not interested, then undo (A14)', async ({ page }) => {
    const api = await playwrightRequest.newContext({ baseURL: API_ORIGIN });
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    await page.waitForLoadState('networkidle');
    const column = page.getByRole('complementary', { name: 'Personnes pertinentes pour vous' });
    await column.getByRole('button', { name: 'Se connecter avec Ifeoma Okafor' }).click();
    await expect(column.getByText('Demande envoyée')).toBeVisible();
    await column.getByRole('button', { name: 'Pas intéressé par Amina Sow' }).click();
    await expect(column.getByText('Amina Sow')).toHaveCount(0);
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(column.getByText('Amina Sow')).toBeVisible();
    await expect
      .poll(async () => (await stub(api).writes()).map((write) => write.route))
      .toEqual(['connection-request', 'dismiss', 'undo-dismiss']);
  });

  test('keeps an action made offline and sends it once when back online', async ({
    page,
    context,
  }) => {
    const api = await playwrightRequest.newContext({ baseURL: API_ORIGIN });
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    await expect(page.getByRole('link', { name: /^Notifications\s?, 3/ })).toBeVisible();
    // The code kept out of the first load arrives when the page is idle (lib/preload.ts).
    await page.waitForLoadState('networkidle');

    await context.setOffline(true);
    await expect(page.getByText('Vous êtes hors ligne.')).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('combobox', { name: 'Recherche globale' })).toBeFocused();
    await page.keyboard.type('marquer');
    // First the search for the text, then the matching action.
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('option', { name: 'Marquer toutes les notifications comme lues' }),
    ).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 action en attente.')).toBeVisible();
    expect(await stub(api).writes()).toEqual([]);

    await context.setOffline(false);
    await expect(page.getByText('Connexion rétablie : 1 action envoyée.')).toBeVisible();
    await expect.poll(async () => (await stub(api).writes()).length).toBe(1);
    const [write] = await stub(api).writes();
    expect(write?.route).toBe('read-all');
    expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(write?.replay).toBe(false);
    await expect(page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible();
    await api.dispose();
  });

  test(
    'keeps a reaction made offline after the tab closes, and sends it once',
    {
      tag: '@phone',
    },
    async ({ context }) => {
      const api = await playwrightRequest.newContext({ baseURL: API_ORIGIN });
      const first = await context.newPage();
      await signIn(first, AISSATOU);
      await first.goto('/fr/feed');
      await first.waitForLoadState('networkidle');

      await context.setOffline(true);
      const like = first.getByRole('article').first().getByRole('button', { name: "J'aime" });
      await like.click();
      await expect(like).toHaveAttribute('aria-pressed', 'true');
      await expect(first.getByText('1 action en attente.')).toBeVisible();
      // Kept on the device (IndexedDB) before the tab closes.
      await expect
        .poll(() =>
          first.evaluate(
            () =>
              new Promise<number>((resolve) => {
                const opening = indexedDB.open('pitchorium', 1);
                opening.onsuccess = () => {
                  const read = opening.result
                    .transaction('paused-mutations', 'readonly')
                    .objectStore('paused-mutations')
                    .get('record');
                  read.onsuccess = () =>
                    resolve(
                      (read.result as { state?: { mutations?: unknown[] } } | undefined)?.state
                        ?.mutations?.length ?? 0,
                    );
                };
              }),
          ),
        )
        .toBe(1);
      await first.close();
      expect(await stub(api).writes()).toEqual([]);

      // Back online, the member space opens again: the reaction leaves, once, with its key.
      await context.setOffline(false);
      const second = await context.newPage();
      await second.goto('/fr/feed');
      await expect.poll(async () => (await stub(api).writes()).length).toBe(1);
      const [write] = await stub(api).writes();
      expect(write).toMatchObject({ route: 'reaction', replay: false });
      expect(write?.key).toMatch(/^[0-9a-f-]{36}$/);
      // Opened again, nothing is sent twice.
      await second.reload();
      await second.waitForLoadState('networkidle');
      expect(await stub(api).writes()).toHaveLength(1);
      await api.dispose();
    },
  );
});

/** The member space on a phone: in every engine, and as an iPhone in WebKit (project `iphone`). */
test.describe('member shell on a phone', { tag: '@phone' }, () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps Messages and Notifications in the header of a phone, the rest in the panel', async ({
    page,
  }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    const header = page.getByRole('banner');
    await expect(
      header.getByRole('link', { name: /^Messages\s?, 2 messages non lus$/ }),
    ).toBeVisible();
    await expect(
      header.getByRole('link', { name: /^Notifications\s?, 3 notifications non lues$/ }),
    ).toBeVisible();
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    await menu.click();
    const panel = page.getByRole('dialog', { name: 'Menu' });
    await expect(panel.getByRole('link', { name: 'Réseau' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Projets suivis' })).toBeVisible();
    await expect(panel.getByRole('link', { name: /^Messages/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('carries the side columns in the flow of the feed on a phone', async ({ page }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    const main = page.getByRole('main');
    // No visible title: its name for screen readers, then the composer and the profile.
    await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toHaveClass(/sr-only/);
    await expect(main.getByRole('link', { name: 'Commencer une publication' })).toBeVisible();
    await expect(main.getByRole('region', { name: 'Complétez votre profil' })).toBeVisible();
    // The side columns are not stacked under the feed.
    await expect(page.getByRole('complementary')).toHaveCount(0);
    // The suggestions come among the items: after the third, then after the thirteenth.
    const order = await main.evaluate((element) =>
      [...element.querySelectorAll('article, section[aria-label]')].map((node) =>
        node.tagName === 'ARTICLE' ? 'post' : node.getAttribute('aria-label'),
      ),
    );
    expect(order.slice(0, 5)).toEqual([
      'Complétez votre profil',
      'post',
      'post',
      'post',
      'Personnes pertinentes pour vous',
    ]);
    expect(order.indexOf('Personnes pertinentes pour vous', 5)).toBe(15);
    // Neutral, without the name shown just above it.
    await expect(main.getByText('Propose du mentorat').first()).toBeVisible();
    await expect(main.getByText(/Suggéré parce que|Ifeoma Okafor propose/)).toHaveCount(0);
  });
});

test.describe('member shell, its accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no axe violation in the ${colorScheme} theme`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signIn(page, KOFI);
      await page.goto('/fr/feed');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.length}`)).toEqual([]);
      await context.close();
    });
  }
});

test.describe('administration shell', () => {
  test('guides a moderator without a second factor to turn it on first', async ({ page }) => {
    await signIn(page, CLAUDINE);
    await page.goto('/fr/admin/moderation');
    await expect(page).toHaveURL(/\/fr\/settings\/security\?required=two-factor$/);
    await expect(page.getByText('Double authentification requise')).toBeVisible();
  });

  test('opens to a moderator, with its side navigation and breadcrumbs', async ({ page }) => {
    await signIn(page, KOFFI);
    await page.goto('/fr/admin/moderation');
    await expect(page.getByRole('heading', { level: 1, name: 'Modération' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toContainText(
      'Administration',
    );
    await expect(
      page
        .getByRole('complementary', { name: 'Administration' })
        .getByRole('link', { name: 'Modération' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('does not exist for a member without the role', async ({ page }) => {
    await signIn(page, AISSATOU);
    const response = await page.goto('/fr/admin');
    expect(response?.status()).toBe(404);
  });
});
