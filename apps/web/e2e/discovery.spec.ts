import AxeBuilder from '@axe-core/playwright';
import { allowConsole, expect, signIn, stub, test } from './support/fixtures';

/**
 * Search, Discover, events, missions and pending invitations (PROMPT FRONT 7) against the stub
 * api (e2e/support/stub-discovery.mjs): the palette with a typo and the keyboard, the results
 * page with its filters in the address, a visitor's public search, the waiting list of a full
 * event, the refusal of a job vocabulary, an organisation invitation answered without the email,
 * a team invitation accepted from its notification, and axe in both themes.
 */
const MEMBER = 'aissatou.ba@demo.pitchorium.test';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

test.describe('search and discovery', () => {
  test('finds a person despite a typo in the palette and opens it from the keyboard', async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/feed');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Recherche globale' });
    await expect(palette.getByRole('combobox')).toBeFocused();
    await page.keyboard.type('thiery');
    const result = palette.getByRole('option', { name: /^Thierry Lacroix/ });
    await expect(result).toBeVisible();
    await expect(palette.getByRole('group', { name: 'Personnes' })).toBeVisible();
    await expect(result).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/fr\/members\/thierry-lacroix$/);
  });

  test('keeps the query, the kind and the filters in a shareable address', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/search?q=solaire');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Résultats pour « solaire »');
    await page.getByRole('tab', { name: 'Projets' }).click();
    await expect(page).toHaveURL(/type=project/);
    await expect(page.locator('[data-result-kind="project"]').first()).toBeVisible();
    const shared = page.url();
    await page.goto(shared);
    await expect(page.getByRole('tab', { name: 'Projets' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.goto('/fr/search?q=zzzz');
    await expect(page.getByRole('heading', { name: 'Aucun résultat pour « zzzz »' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Découvrir' })).toBeVisible();
  });

  test('searches what is public only for a visitor, never indexed with a query', async ({
    page,
  }) => {
    await page.goto('/fr/search?q=thierry');
    await expect(
      page.getByText('Vous cherchez parmi ce qui est public.', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('[data-result-kind="person"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/fr/discover');
    await expect(page.getByRole('heading', { name: 'Projets récents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profils suggérés' })).toHaveCount(0);
  });

  test('shows the suggested profiles of a member with their reason', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/discover');
    const suggested = page.getByRole('region', { name: 'Profils suggérés' });
    await expect(suggested.getByText('Propose du mentorat')).toBeVisible();
    await expect(suggested.getByRole('button', { name: 'Se connecter' }).first()).toBeVisible();
  });
});

test.describe('events', () => {
  test('joins the waiting list of a full event and sees its position', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/events/atelier-levee-de-fonds');
    // The registration is an island of the member view: it answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Complet · 1 en liste d’attente')).toBeVisible();
    await expect(page.getByText('Le lien de connexion est donné aux inscrits.')).toBeVisible();
    const join = page.getByRole('button', { name: 'Rejoindre la liste d’attente' });
    const width = (await join.boundingBox())?.width ?? 0;
    await join.click();
    await expect(page.getByText(/Vous êtes en liste d’attente, position/)).toBeVisible();
    const leave = page.getByRole('button', { name: 'Quitter la liste d’attente' });
    await expect(leave).toBeVisible();
    expect(Math.abs(((await leave.boundingBox())?.width ?? 0) - width)).toBeLessThan(80);
    const writes = await stub(request).writes();
    expect(writes.map((write) => write.route)).toContain('event-register');
  });

  test('says a canceled event and the hours in the zone of the place', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/events/rencontre-assureurs-kano');
    await expect(page.getByText('Événement annulé', { exact: true })).toBeVisible();
    await expect(page.getByText(/La salle n’est plus disponible/)).toBeVisible();
    await expect(page.locator('[data-event-times]')).toContainText('à Lagos');
  });

  test('describes a public event to a visitor with its structured data', async ({ page }) => {
    await page.goto('/fr/events/webinaire-mecenat-diaspora');
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    ) as Record<string, unknown>;
    expect(data).toMatchObject({
      '@type': 'Event',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      startDate: '2027-04-02T19:00:00+02:00',
    });
    await expect(page.getByRole('link', { name: /Google Agenda/ })).toHaveAttribute(
      'href',
      /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/,
    );
  });

  test('creates the address of the personal calendar, then revokes it', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/settings/calendar');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Créer mon adresse de calendrier' }).click();
    await expect(page.getByRole('textbox', { name: 'Adresse du calendrier' })).toHaveValue(
      /\/v1\/calendars\/.+\.ics$/,
    );
    await expect(page.getByText('Adresse secrète')).toBeVisible();
    await page.getByRole('button', { name: 'Révoquer l’adresse' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Révoquer l’adresse' }).click();
    await expect(
      page.getByText('Adresse révoquée : elle ne fonctionne plus.').first(),
    ).toBeVisible();
  });
});

test.describe('missions', () => {
  test('explains the refusal of a job vocabulary under the description', async ({ page }) => {
    // The refusal of the api is the subject of the test.
    allowConsole(/status of 422 .*\/v1\/missions\/offers/);
    await signIn(page, MEMBER);
    await page.goto('/fr/missions/new?direction=offer');
    await page.waitForLoadState('networkidle');
    await page.getByRole('textbox', { name: 'Titre' }).fill('Mentorat marketing');
    await page
      .getByRole('textbox', { name: 'Description' })
      .fill('Recrutement en CDI avec salaire attractif.');
    await page.getByRole('textbox', { name: 'Champ d’expertise' }).fill('Marketing');
    await page.getByRole('textbox', { name: 'Heures estimées' }).fill('4');
    await page.getByRole('button', { name: 'Publier la mission' }).click();
    await expect(
      page.getByText(/Une mission est bénévole : retirez le vocabulaire/).first(),
    ).toBeVisible();
  });

  test('applies to a request with a message and follows the engagement', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/missions');
    await expect(page.getByText('Mécénat de compétences, bénévole')).toBeVisible();
    await page.goto('/fr/missions/engagements/0192f4a0-7000-7000-8000-000000000602');
    await expect(page.locator('[data-time-entry="declared"]')).toContainText('2,5 h');
    await expect(page.getByRole('link', { name: 'Ouvrir le journal du temps' })).toBeVisible();
  });
});

test.describe('pending invitations', () => {
  test('accepts an organisation invitation from the list, without the email', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/network/invitations');
    await page.waitForLoadState('networkidle');
    const card = page.locator('[data-invitation]').first();
    await expect(card).toContainText('Diaspora Invest Caraïbes');
    await card.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(page).toHaveURL(/\/fr\/organizations\/diaspora-invest-caraibes$/);
    expect((await stub(request).writes()).map((write) => write.route)).toContain(
      'organization-invitation-accept',
    );
  });

  test('accepts a team invitation with its consent from the list', async ({ page, request }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/network/invitations');
    await page.waitForLoadState('networkidle');
    const join = page.getByRole('button', { name: 'Rejoindre l’équipe' });
    await join.click();
    await expect(page.getByText('Cochez le consentement pour rejoindre l’équipe.')).toBeVisible();
    await page.getByRole('checkbox', { name: /affichés publiquement/ }).check();
    await join.click();
    await expect(page).toHaveURL(/\/fr\/projects\/reseau-cooperatives-jacmel$/);
    const writes = (await stub(request).writes()) as unknown as {
      route: string;
      consent?: boolean;
    }[];
    expect(writes).toContainEqual(
      expect.objectContaining({ route: 'team-invitation-accept', consent: true }),
    );
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`new screens pass axe in the ${colorScheme} theme`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await signIn(page, MEMBER);
    for (const path of [
      '/fr/search?q=solaire',
      '/fr/discover',
      '/fr/events',
      '/fr/events/atelier-levee-de-fonds',
      '/fr/settings/calendar',
      '/fr/missions',
      '/fr/missions/0192f4a0-7000-7000-8000-000000000301',
      '/fr/missions/engagements/0192f4a0-7000-7000-8000-000000000601',
      '/fr/network/invitations',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const audit = await new AxeBuilder({ page }).include('main').analyze();
      expect(audit.violations, path).toEqual([]);
    }
    await context.close();
  });
}
