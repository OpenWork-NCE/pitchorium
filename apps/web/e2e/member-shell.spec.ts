import AxeBuilder from '@axe-core/playwright';
import { request as playwrightRequest } from '@playwright/test';
import { API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

const AISSATOU = 'aissatou.ba@demo.pitchorium.test';
const KOFI = 'kofi.mensah@demo.pitchorium.test';
const CLAUDINE = 'claudine.pierre.louis@demo.pitchorium.test';
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
    await expect(page.getByRole('complementary', { name: 'Suggestions' })).toBeVisible();
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
      page.getByRole('link', { name: 'Réseau' }),
      page.getByRole('link', { name: 'Projets' }),
      page.getByRole('link', { name: /^Messages/ }),
      page.getByRole('link', { name: /^Notifications/ }),
      page.getByRole('link', { name: 'Profil' }),
      page.getByRole('link', { name: 'Publier' }),
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
    await expect(page.getByRole('menuitem', { name: 'Paramètres' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(order.at(-1)!).toBeFocused();

    // A section by its link, then by a shortcut; the focus moves to the new content.
    await page.getByRole('link', { name: 'Réseau' }).press('Enter');
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
      'À compléter d’abord : Acceptation des conditions, Email vérifié.',
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

  test('opens the sections in a panel on a phone, and gives the focus back', async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await signIn(page, AISSATOU);
    await page.goto('/fr/feed');
    const menu = page.getByRole('button', { name: 'Menu, 5 à traiter' });
    await menu.click();
    const panel = page.getByRole('dialog', { name: 'Menu' });
    await expect(panel.getByRole('link', { name: 'Réseau' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(menu).toBeFocused();
    await context.close();
  });

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
  test('opens to a moderator, with its side navigation and breadcrumbs', async ({ page }) => {
    await signIn(page, CLAUDINE);
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
