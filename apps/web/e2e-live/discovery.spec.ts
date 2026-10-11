import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import {
  allowConsole,
  api,
  apiProject,
  entrepreneur,
  expect,
  hydrated,
  memberPage,
  ok,
  test,
} from './support';

/**
 * Search, Discover, events, missions and pending invitations (PROMPT FRONT 7) against the real
 * api and its worker: the index, the waiting list, the notifications and the time log are the
 * real ones. Members are created through the api; each journey has its own.
 */

/** A name no other journey uses, of letters only, so that a typo of it stays searchable. */
function uniqueName(first: string): string {
  const letters = 'bcdfghjklmnpqrstvz';
  const suffix = [...crypto.getRandomValues(new Uint8Array(6))]
    .map((value) => letters[value % letters.length])
    .join('');
  return `${first} ${suffix.charAt(0).toUpperCase()}${suffix.slice(1)}ova`;
}

/** Waits until the search of the api finds a text (the index is written by the worker). */
async function indexed(page: Page, query: string, kind: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const response = await api(
          page,
          'GET',
          `/v1/discovery/autocomplete?q=${encodeURIComponent(query)}&kinds=${kind}`,
        );
        const body = (await response.json()) as { items?: unknown[] };
        return body.items?.length ?? 0;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBeGreaterThan(0);
}

/** A member who gives their time as an expert (contributor facet with the hat). */
async function expert(browser: Browser, label: string, name: string) {
  const member = await memberPage(browser, label, { name });
  await ok(
    api(member.page, 'POST', '/v1/me/profile/contributor-facet', {
      hats: ['expert', 'mentor'],
      structureType: 'individual',
    }),
  );
  return member;
}

/** An event created and published through the api by its organizer. */
async function apiEvent(
  page: Page,
  title: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const start = Date.now() + 3 * 24 * 3_600_000;
  const created = (await (
    await ok(
      api(page, 'POST', '/v1/events', {
        title,
        description: '## Programme\n\nDes **ateliers** pratiques.',
        format: 'hybrid',
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(start + 2 * 3_600_000).toISOString(),
        timeZone: 'Africa/Dakar',
        location: { name: 'Impact Hub', address: null, city: 'Dakar', countryCode: 'SN' },
        onlineUrl: 'https://meet.example.org/atelier',
        language: 'fr',
        sectorCodes: ['energy'],
        capacity: 1,
        visibility: 'members',
        ...overrides,
      }),
    )
  ).json()) as { id: string; slug: string };
  await ok(api(page, 'POST', `/v1/events/${created.id}/publish`));
  return created;
}

test.describe('search and discovery', () => {
  test(
    'finds a member despite a typo in the palette and opens them from the keyboard',
    { tag: '@critical' },
    async ({ browser }) => {
      const name = uniqueName('Zephyrine');
      const found = await memberPage(browser, 'search-found', { name });
      const { page, context } = await memberPage(browser, 'search-reader', { name: 'Omar Sy' });
      await indexed(page, name, 'person');
      await page.goto('/fr/feed');
      await hydrated(page);
      await page.keyboard.press('Control+k');
      const palette = page.getByRole('dialog', { name: 'Recherche globale' });
      await expect(palette.getByRole('combobox')).toBeFocused();
      // One letter left out of the first name.
      await page.keyboard.type(name.replace('Zephyrine', 'Zephyrne'));
      const result = palette.getByRole('option', { name: new RegExp(`^${name}`) });
      await expect(result).toBeVisible({ timeout: 10_000 });
      await expect(result).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/fr/members/${found.member.handle}$`));
      await context.close();
      await found.context.close();
    },
  );

  test('filters the results by kind and shares the address of the search', async ({ browser }) => {
    const name = uniqueName('Amandine');
    const found = await memberPage(browser, 'results-found', { name });
    const { page, context } = await memberPage(browser, 'results-reader', { name: 'Omar Sy' });
    await indexed(page, name, 'person');
    await page.goto(`/fr/search?q=${encodeURIComponent(name)}`);
    await hydrated(page);
    await page.getByRole('tab', { name: 'Personnes' }).click();
    await expect(page).toHaveURL(/type=person/);
    await expect(page.getByRole('link', { name })).toBeVisible();
    const shared = await context.newPage();
    await shared.goto(page.url());
    await expect(shared.getByRole('tab', { name: 'Personnes' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(shared.getByRole('link', { name })).toBeVisible();
    await context.close();
    await found.context.close();
  });

  test('keeps a visitor to what is public, in search and in Discover', async ({ browser }) => {
    const name = uniqueName('Clemence');
    const found = await memberPage(browser, 'visitor-search', { name });
    await indexed(found.page, name, 'person');
    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await page.goto(`/fr/search?q=${encodeURIComponent(name)}`);
    // Without a public page, the member is not in the public documents.
    await expect(
      page.getByRole('heading', { name: `Aucun résultat pour « ${name} »` }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/fr/discover');
    await expect(page.getByRole('heading', { name: 'Projets récents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profils suggérés' })).toHaveCount(0);
    await found.page.goto('/fr/discover');
    await expect(found.page.getByRole('heading', { name: 'Profils suggérés' })).toBeVisible();
    await visitor.close();
    await found.context.close();
  });
});

test.describe('events', () => {
  test(
    'joins the waiting list of a full event and is promoted when a seat frees up',
    { tag: '@critical' },
    async ({ browser }) => {
      const organizer = await memberPage(browser, 'event-organizer', { name: 'Awa Ndiaye' });
      const event = await apiEvent(organizer.page, `Atelier solaire ${Date.now()}`);
      const first = await memberPage(browser, 'event-first', { name: 'Kofi Asante' });
      await ok(api(first.page, 'PUT', `/v1/events/${event.id}/registration`, {}));

      const { page, context } = await memberPage(browser, 'event-waiting', { name: 'Fatou Sow' });
      await page.goto(`/fr/events/${event.slug}`);
      await hydrated(page);
      await expect(page.getByText('Le lien de connexion est donné aux inscrits.')).toBeVisible();
      await page.getByRole('button', { name: 'Rejoindre la liste d’attente' }).click();
      // The block itself: the announcer says the same sentence for screen readers.
      const block = page.locator('[data-registration-state="waitlisted"]');
      await expect(block).toContainText(/Vous êtes en liste d’attente, position\s*1/);

      // The first member withdraws: the seat goes to the waiting list, said in real time.
      await ok(api(first.page, 'DELETE', `/v1/events/${event.id}/registration`));
      await expect(page.locator('[data-registration-state="registered"]')).toContainText(
        'Vous êtes inscrit.',
        { timeout: 30_000 },
      );
      await expect(
        page.getByRole('link', { name: /Rejoindre l’événement en ligne/ }),
      ).toBeVisible();
      await context.close();
      await first.context.close();
      await organizer.context.close();
    },
  );

  test('cancels an event with a reason and tells the registered members', async ({ browser }) => {
    const organizer = await memberPage(browser, 'cancel-organizer', { name: 'Awa Ndiaye' });
    const title = `Rencontre annulée ${Date.now()}`;
    const event = await apiEvent(organizer.page, title, { capacity: 10 });
    const attendee = await memberPage(browser, 'cancel-attendee', { name: 'Kofi Asante' });
    await ok(api(attendee.page, 'PUT', `/v1/events/${event.id}/registration`, {}));

    await organizer.page.goto(`/fr/events/${event.slug}`);
    await hydrated(organizer.page);
    await organizer.page.getByRole('button', { name: 'Annuler l’événement' }).click();
    const dialog = organizer.page.getByRole('dialog');
    await dialog.getByLabel(/Motif/).fill('La salle n’est plus disponible.');
    await dialog.getByRole('button', { name: 'Annuler l’événement' }).click();
    await expect(organizer.page.getByText('Événement annulé', { exact: true })).toBeVisible();

    await expect
      .poll(
        async () => {
          const response = await api(attendee.page, 'GET', '/v1/me/notifications');
          const body = (await response.json()) as { items: { type: string }[] };
          return body.items.some((item) => item.type === 'event_canceled');
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await attendee.page.goto('/fr/notifications');
    await expect(attendee.page.locator('[data-notification-type="event_canceled"]')).toBeVisible();
    await organizer.context.close();
    await attendee.context.close();
  });

  test('creates the personal calendar, reads it, then revokes it', async ({ browser }) => {
    const { page, context } = await memberPage(browser, 'calendar', { name: 'Nadia Benali' });
    await page.goto('/fr/settings/calendar');
    await hydrated(page);
    await page.getByRole('button', { name: 'Créer mon adresse de calendrier' }).click();
    const field = page.getByRole('textbox', { name: 'Adresse du calendrier' });
    await expect(field).toHaveValue(/\/v1\/calendars\/.+\.ics$/);
    const url = await field.inputValue();
    const feed = await page.request.get(url);
    expect(feed.status()).toBe(200);
    expect(await feed.text()).toContain('BEGIN:VCALENDAR');
    await page.getByRole('button', { name: 'Révoquer l’adresse' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Révoquer l’adresse' }).click();
    await expect(
      page.getByText('Adresse révoquée : elle ne fonctionne plus.').first(),
    ).toBeVisible();
    allowConsole(/status of 404/);
    expect((await page.request.get(url)).status()).toBe(404);
    await context.close();
  });
});

test.describe('missions', () => {
  test(
    'an offer is solicited, accepted, completed, then its hours confirmed in the time log',
    { tag: '@critical' },
    async ({ browser }) => {
      const helper = await expert(browser, 'mission-expert', 'Thierry Lacroix');
      await helper.page.goto('/fr/missions/new?direction=offer');
      await hydrated(helper.page);
      const title = `Revue de plan de financement ${Date.now()}`;
      await helper.page.getByRole('textbox', { name: 'Titre' }).fill(title);
      await helper.page
        .getByRole('textbox', { name: 'Description' })
        .fill('Deux sessions pour relire votre plan et vos hypothèses.');
      await helper.page.getByRole('textbox', { name: 'Champ d’expertise' }).fill('Finance');
      await helper.page.getByRole('radio', { name: 'Expertise' }).click();
      await helper.page.getByRole('textbox', { name: 'Heures estimées' }).fill('4');
      await helper.page.getByRole('button', { name: 'Publier la mission' }).click();
      await expect(helper.page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(
        helper.page.getByText('Mission bénévole de mécénat de compétences'),
      ).toBeVisible();
      const missionUrl = helper.page.url();

      const helped = await entrepreneur(browser, 'mission-helped', 'Aminata Diop');
      await helped.page.goto(missionUrl);
      await hydrated(helped.page);
      await helped.page.getByRole('button', { name: 'Solliciter cette mission' }).click();
      const dialog = helped.page.getByRole('dialog', { name: 'Solliciter cette mission' });
      await dialog
        .getByRole('textbox', { name: 'Message' })
        .fill('Bonjour, pouvez-vous relire notre plan de financement ?');
      await dialog.getByRole('button', { name: 'Envoyer' }).click();
      await expect(helped.page).toHaveURL(/\/fr\/missions\/engagements\//);
      const engagementUrl = helped.page.url();

      await helper.page.goto(engagementUrl);
      await hydrated(helper.page);
      await helper.page.getByRole('button', { name: 'Accepter' }).click();
      await expect(helper.page.locator('[data-engagement-status="accepted"]')).toBeVisible();
      await helper.page.getByRole('button', { name: 'Marquer comme terminée' }).click();
      const complete = helper.page.getByRole('dialog', { name: 'Terminer la mission' });
      await complete.getByRole('textbox', { name: 'Heures' }).fill('2');
      await complete.getByRole('textbox', { name: 'Minutes' }).fill('30');
      await complete
        .getByRole('textbox', { name: 'Ce qui a été fait' })
        .fill('Deux sessions de revue du plan de financement.');
      await complete.getByRole('button', { name: 'Terminer et déclarer le temps' }).click();
      await expect(helper.page.locator('[data-engagement-status="completed"]')).toBeVisible();
      await expect(helper.page.locator('[data-time-entry="declared"]')).toContainText('2,5 h');

      // The beneficiary confirms the hours in the time log: no second entry.
      await helped.page.goto('/fr/dashboard/time');
      const received = helped.page.getByTestId('time-entry').filter({ hasText: 'Thierry Lacroix' });
      await received.getByRole('button', { name: 'Confirmer' }).click();
      await expect(received).toContainText('Confirmé');
      await helped.page.goto(engagementUrl);
      await expect(helped.page.locator('[data-time-entry="confirmed"]')).toBeVisible();
      await helper.context.close();
      await helped.context.close();
    },
  );

  test('explains the refusal of the vocabulary of a job offer', async ({ browser }) => {
    allowConsole(/status of 422 .*\/v1\/missions\/offers/);
    const helper = await expert(browser, 'mission-refused', 'Thierry Lacroix');
    await helper.page.goto('/fr/missions/new?direction=offer');
    await hydrated(helper.page);
    await helper.page.getByRole('textbox', { name: 'Titre' }).fill('Mentorat commercial');
    await helper.page
      .getByRole('textbox', { name: 'Description' })
      .fill('Poste en CDI, salaire selon profil, recrutement rapide.');
    await helper.page.getByRole('textbox', { name: 'Champ d’expertise' }).fill('Vente');
    await helper.page.getByRole('textbox', { name: 'Heures estimées' }).fill('4');
    await helper.page.getByRole('button', { name: 'Publier la mission' }).click();
    await expect(
      helper.page.getByText(/Une mission est bénévole : retirez le vocabulaire/).first(),
    ).toBeVisible();
    await expect(helper.page).toHaveURL(/\/fr\/missions\/new/);
    await helper.context.close();
  });
});

test.describe('pending invitations', () => {
  test('accepts an invitation to an organisation from the list, without the email', async ({
    browser,
  }) => {
    const owner = await memberPage(browser, 'invite-owner', { name: 'Awa Ndiaye' });
    const name = `Fondation ${Date.now()}`;
    const organization = (await (
      await ok(
        api(owner.page, 'POST', '/v1/organizations', {
          name,
          structureType: 'foundation',
          countryCodes: ['SN'],
        }),
      )
    ).json()) as { id: string; slug: string };
    const invitee = await memberPage(browser, 'invite-member', { name: 'Kofi Asante' });
    await ok(
      api(owner.page, 'POST', `/v1/organizations/${organization.id}/invitations`, {
        email: invitee.member.email,
        role: 'member',
      }),
    );
    await invitee.page.goto('/fr/network/invitations');
    await hydrated(invitee.page);
    const card = invitee.page.locator('[data-invitation]').filter({ hasText: name });
    await card.getByRole('button', { name: 'Rejoindre' }).click();
    await expect(invitee.page).toHaveURL(new RegExp(`/fr/organizations/${organization.slug}$`));
    const mine = (await (await ok(api(invitee.page, 'GET', '/v1/me/organizations'))).json()) as {
      items: { id: string }[];
    };
    expect(mine.items.map((item) => item.id)).toContain(organization.id);
    await owner.context.close();
    await invitee.context.close();
  });

  test('accepts an invitation to a team from its notification, with the consent', async ({
    browser,
  }) => {
    const holder = await entrepreneur(browser, 'team-holder', 'Aïssatou Ba');
    const title = `Pompes solaires ${Date.now()}`;
    const project = await apiProject(holder.page, title);
    const invitee = await memberPage(browser, 'team-invitee', { name: 'Ama Owusu' });
    await ok(
      api(holder.page, 'POST', `/v1/projects/${project.id}/team/invitations`, {
        handle: invitee.member.handle,
        role: 'editor',
      }),
    );
    // The worker writes the notification; arrived after the page, it would wait for its pill.
    await expect
      .poll(
        async () => {
          const response = await api(invitee.page, 'GET', '/v1/me/notifications');
          const body = (await response.json()) as { items: { type: string }[] };
          return body.items.some((item) => item.type === 'project_team_invitation');
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await invitee.page.goto('/fr/notifications');
    await hydrated(invitee.page);
    const line = invitee.page
      .locator('[data-notification-type="project_team_invitation"]')
      .getByRole('button', { name: /vous invite/ });
    await expect(line).toBeVisible();
    await line.click();
    const dialog = invitee.page.getByRole('dialog', { name: new RegExp(title) });
    await dialog.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
    await expect(dialog.getByText('Cochez le consentement pour rejoindre l’équipe.')).toBeVisible();
    await dialog.getByRole('checkbox', { name: /affichés publiquement/ }).check();
    await dialog.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
    await expect(invitee.page).toHaveURL(new RegExp(`/fr/projects/${project.slug}$`));
    await holder.context.close();
    await invitee.context.close();
  });
});

test('the new screens pass axe', async ({ browser }) => {
  const organizer = await memberPage(browser, 'axe-organizer', { name: 'Awa Ndiaye' });
  const event = await apiEvent(organizer.page, `Atelier axe ${Date.now()}`);
  const { page, context } = organizer;
  for (const path of [
    '/fr/search?q=atelier',
    '/fr/discover',
    '/fr/events',
    `/fr/events/${event.slug}`,
    '/fr/events/new',
    '/fr/settings/calendar',
    '/fr/missions',
    '/fr/missions/new?direction=request',
    '/fr/network/invitations',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const audit = await new AxeBuilder({ page }).include('main').analyze();
    expect(audit.violations, path).toEqual([]);
  }
  await context.close();
});
