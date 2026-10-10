import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import {
  allowConsole,
  api,
  choose,
  expect,
  hydrated,
  memberPage,
  ok,
  pngImage,
  test,
  WEB_URL,
} from './support';

const DEMO_PASSWORD = 'pitchorium-demo-2026';
const eur = (euros: number) => ({ amountMinor: String(euros * 100), currency: 'EUR' });

/** A new member with an entrepreneur facet, signed in in a context of their own. */
async function entrepreneur(browser: Browser, label: string, name: string) {
  const member = await memberPage(browser, label, { name });
  await ok(
    api(member.page, 'POST', '/v1/me/profile/entrepreneur-facet', {
      companyName: `${name} SARL`,
      sectorCode: 'energy',
      stageCode: 'prototype',
      companyCountryCode: 'SN',
    }),
  );
  return member;
}

/** A demonstration member (`pnpm db:seed:dev`) signed in in a context of their own. */
async function demoPage(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await ok(api(page, 'POST', '/v1/auth/sign-in/email', { email, password: DEMO_PASSWORD }));
  return { context, page };
}

/** Answers every criterion of the published methodology at its highest level. */
async function answers(
  page: Page,
): Promise<{ methodologyId: string; answers: Record<string, string> }> {
  const methodology = (await (await ok(api(page, 'GET', '/v1/impact/methodology'))).json()) as {
    id: string;
    criteria: { key: string; scale: { key: string }[] }[];
  };
  return {
    methodologyId: methodology.id,
    answers: Object.fromEntries(
      methodology.criteria.map((criterion) => [criterion.key, criterion.scale.at(-1)!.key]),
    ),
  };
}

/** A complete project through the api, published unless asked otherwise. */
async function apiProject(
  page: Page,
  title: string,
  { publish = true, goal = 20_000 }: { publish?: boolean; goal?: number } = {},
): Promise<{ id: string; slug: string }> {
  const created = (await (
    await ok(
      api(page, 'POST', '/v1/projects', {
        title,
        summary: 'Des pompes solaires louées aux coopératives maraîchères.',
        description: '## Pourquoi\n\nLes maraîchères perdent un tiers de leurs récoltes.',
        sectorCode: 'energy',
        impactArea: 'Région de Thiès',
        countryCodes: ['SN'],
        instruments: ['donation', 'reward_crowdfunding'],
        goal: eur(goal),
        durationDays: 45,
      }),
    )
  ).json()) as { id: string; slug: string };
  await ok(
    api(page, 'PUT', `/v1/projects/${created.id}/tiers`, {
      tiers: [
        { threshold: eur(goal / 4), description: 'Deux pompes installées' },
        { threshold: eur(goal), description: 'L’atelier de maintenance' },
      ],
    }),
  );
  await ok(api(page, 'POST', `/v1/projects/${created.id}/impact-assessments`, await answers(page)));
  if (publish) {
    await ok(
      api(page, 'POST', `/v1/projects/${created.id}/publish`, { publicDisplayConsent: true }),
    );
  }
  return created;
}

/** Waits for the indicator of the assistant to say the draft is saved. */
async function saved(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré' })).toBeVisible();
}

/** Projects against the real api (§11, PROMPT FRONT 5A). */
test.describe('projects', () => {
  test(
    'a holder creates a project step by step and publishes it with the public display consent',
    { tag: '@critical' },
    async ({ browser }) => {
      test.slow();
      const { page, context } = await entrepreneur(browser, 'project-create', 'Mariama Faye');
      const title = `Pompes solaires de Kaolack ${Date.now()}`;
      await page.goto('/fr/projects/new');
      await hydrated(page);
      await page.getByLabel('Titre du projet').fill(title);
      await page
        .getByLabel('Résumé')
        .fill('Des pompes solaires louées aux maraîchères de Kaolack.');
      await choose(page, 'Secteur', 'Énergie');
      await choose(page, 'Pays', 'Sénégal', 'Sénégal');
      await page.keyboard.press('Escape');
      await page.getByLabel('Zone d’impact').fill('Région de Kaolack');
      await page.getByRole('button', { name: 'Créer le brouillon et continuer' }).click();

      await page.waitForURL(/\/edit\/story$/);
      await expect(
        page.getByRole('heading', { level: 1, name: 'L’histoire du projet' }),
      ).toBeVisible();
      await hydrated(page);
      await page
        .getByRole('textbox', { name: 'Histoire' })
        .fill('## Pourquoi\n\nLes récoltes **se perdent** faute d’eau.');
      await saved(page);
      await page.getByRole('tab', { name: 'Aperçu' }).click();
      await expect(page.getByRole('heading', { level: 3, name: 'Pourquoi' })).toBeVisible();

      await page.getByRole('button', { name: 'Suivant : Médias' }).click();
      await page.waitForURL(/\/edit\/media$/);
      await hydrated(page);
      await page
        .locator('input[type=file][accept*="image"]')
        .setInputFiles(await pngImage(page, 1200, 900));
      await page
        .getByLabel('Texte alternatif de l’image 1')
        .fill('Une pompe solaire au bord d’un champ');
      await saved(page);

      await page.getByRole('button', { name: 'Suivant : Financement' }).click();
      await page.waitForURL(/\/edit\/funding$/);
      await hydrated(page);
      await page.getByLabel('Objectif').fill('20000');
      await page.getByLabel('Objectif').blur();
      await page.getByLabel('Durée de la campagne').fill('45');
      await page.getByRole('button', { name: 'Ajouter un palier' }).click();
      await page.getByLabel('Montant cumulé').first().fill('5000');
      await page.getByLabel('Montant cumulé').first().blur();
      await page.getByLabel('Usage des fonds').first().fill('Deux pompes installées');
      // A threshold above the goal is said at once, as the api would refuse it.
      await page.getByLabel('Montant cumulé').first().fill('25000');
      await page.getByLabel('Montant cumulé').first().blur();
      await expect(page.getByText('Ce palier doit rester sous l’objectif.')).toBeVisible();
      await page.getByLabel('Montant cumulé').first().fill('5000');
      await page.getByLabel('Montant cumulé').first().blur();
      await page.getByLabel('Usage des fonds').nth(1).fill('L’atelier de maintenance');
      await saved(page);
      await expect(page.getByRole('progressbar', { name: 'Aperçu du financement' })).toBeVisible();

      await page.getByRole('button', { name: 'Suivant : Contreparties' }).click();
      await page.waitForURL(/\/edit\/rewards$/);
      await page.getByRole('button', { name: 'Suivant : Instruments' }).click();
      await page.waitForURL(/\/edit\/instruments$/);
      await hydrated(page);
      await page.getByRole('checkbox', { name: 'Don' }).check();
      await saved(page);

      await page.getByRole('button', { name: 'Suivant : Impact' }).click();
      await page.waitForURL(/\/edit\/impact$/);
      await hydrated(page);
      await expect(page.getByRole('radiogroup').first()).toBeVisible();
      await expect(page.getByRole('radiogroup').first()).toBeVisible();
      for (const group of await page.getByRole('radiogroup').all()) {
        await group.getByRole('radio').last().check();
      }
      await page.getByRole('button', { name: 'Enregistrer l’évaluation' }).click();
      await expect(page.getByTestId('impact-score')).toBeVisible();

      await page.getByRole('button', { name: 'Suivant : Équipe' }).click();
      await page.waitForURL(/\/edit\/team$/);
      await page.getByRole('button', { name: 'Suivant : Aperçu' }).click();
      await page.waitForURL(/\/edit\/preview$/);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByText('Seule l’équipe la voit.', { exact: false })).toBeVisible();

      await page.getByRole('button', { name: 'Suivant : Publication' }).click();
      await page.waitForURL(/\/edit\/publish$/);
      await hydrated(page);
      await page.getByRole('button', { name: 'Publier le projet' }).click();
      await expect(page.getByText('Cochez le consentement pour publier.')).toBeVisible();
      await page.getByRole('checkbox', { name: /J’accepte l’affichage public de mon nom/ }).check();
      await page.getByRole('button', { name: 'Publier le projet' }).click();
      await page.waitForURL(/\/fr\/projects\/[a-z0-9-]+\?published=1$/);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByText('En financement').first()).toBeVisible();
      await context.close();
    },
  );

  test('a draft resumes where it was left after the browser closes', async ({ browser }) => {
    const first = await entrepreneur(browser, 'project-resume', 'Ousmane Sy');
    const draft = (await (
      await ok(api(first.page, 'POST', '/v1/projects', { title: `Brouillon ${Date.now()}` }))
    ).json()) as { slug: string };
    await first.page.goto(`/fr/projects/${draft.slug}/edit/essentials`);
    await hydrated(first.page);
    await first.page.getByLabel('Résumé').fill('Un résumé écrit avant la fermeture.');
    await saved(first.page);
    await first.context.close();

    const context = await browser.newContext();
    const page = await context.newPage();
    await ok(
      api(page, 'POST', '/v1/auth/sign-in/email', {
        email: first.member.email,
        password: 'correct horse battery staple 2026',
      }),
    );
    // The draft resumes at its first step still incomplete, its values read from the api.
    await page.goto(`/fr/projects/${draft.slug}/edit`);
    await page.waitForURL(/\/edit\/essentials$/);
    await expect(page.getByLabel('Résumé')).toHaveValue('Un résumé écrit avant la fermeture.');
    await context.close();
  });

  test('the preview of a draft is for its team only', async ({ browser }) => {
    // The pages of the draft answer 404 to another member and to a visitor, on purpose.
    allowConsole(/status of 404 .*\/fr\/projects\//);
    const owner = await entrepreneur(browser, 'project-preview', 'Khady Ndiaye');
    const draft = await apiProject(owner.page, `Aperçu privé ${Date.now()}`, { publish: false });
    await owner.page.goto(`/fr/projects/${draft.slug}/edit/preview`);
    await expect(owner.page.getByText('Seule l’équipe la voit.', { exact: false })).toBeVisible();
    await expect(owner.page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    const other = await memberPage(browser, 'project-preview-other', { name: 'Paul Mendy' });
    const response = await other.page.goto(`/fr/projects/${draft.slug}/edit/preview`);
    expect(response?.status()).toBe(404);
    expect((await other.page.goto(`/fr/projects/${draft.slug}`))?.status()).toBe(404);
    const visitor = await browser.newPage();
    expect((await visitor.goto(`${WEB_URL}/fr/projects/${draft.slug}`))?.status()).toBe(404);
    await visitor.close();
    await owner.context.close();
    await other.context.close();
  });

  test(
    'a visitor reads the public page, its metadata and its structured data',
    { tag: '@critical' },
    async ({ browser, page }) => {
      const owner = await entrepreneur(browser, 'project-public', 'Fatou Kane');
      const title = `Ferme solaire publique ${Date.now()}`;
      const project = await apiProject(owner.page, title);
      await owner.context.close();
      await page.goto(`/fr/projects/${project.slug}`);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        `${title} | Pitchorium`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        'Des pompes solaires louées aux coopératives maraîchères.',
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        new RegExp(`/fr/projects/${project.slug}$`),
      );
      const structured = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
      ) as Record<string, unknown>;
      expect(structured).toMatchObject({
        '@type': 'Article',
        headline: title,
        author: { '@type': 'Person', name: 'Fatou Kane' },
        publisher: { '@type': 'Organization', name: 'Pitchorium' },
      });
      await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
        'href',
        /^https:\/\/wa\.me\/\?text=/,
      );
      await expect(
        page.getByRole('link', { name: 'Se connecter pour suivre le projet' }).first(),
      ).toBeVisible();
      const shareUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
      const share = await page.request.get(shareUrl!);
      expect(share.headers()['content-type']).toBe('image/png');
    },
  );

  test('a follower reads an update of the project in their feed', async ({ browser }) => {
    test.slow();
    const owner = await entrepreneur(browser, 'project-update', 'Abdou Sarr');
    const title = `Séchoirs suivis ${Date.now()}`;
    const project = await apiProject(owner.page, title);
    const follower = await memberPage(browser, 'project-follower', { name: 'Clara Mbaye' });
    await follower.page.goto(`/fr/projects/${project.slug}`);
    await hydrated(follower.page);
    await follower.page
      .getByRole('button', { name: `Suivre ${title}` })
      .first()
      .click();
    await expect(
      follower.page.getByRole('button', { name: `Ne plus suivre ${title}` }).first(),
    ).toBeVisible();

    await owner.page.goto(`/fr/projects/${project.slug}/manage?tab=updates`);
    await hydrated(owner.page);
    await owner.page.getByLabel('Texte').fill('Le premier séchoir est monté à Podor.');
    await owner.page.getByRole('button', { name: 'Publier l’actualité' }).click();
    await expect(
      owner.page.getByText('Le premier séchoir est monté à Podor.').last(),
    ).toBeVisible();

    await follower.page.goto('/fr/feed');
    const card = follower.page.getByRole('article', { name: new RegExp(title) });
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: new RegExp(title) }).click();
    await expect(follower.page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await owner.context.close();
    await follower.context.close();
  });

  test('an expression of interest reaches the management of the project', async ({ browser }) => {
    const owner = await entrepreneur(browser, 'project-interest-owner', 'Seynabou Diallo');
    const project = await apiProject(owner.page, `Karité intéressé ${Date.now()}`);
    const funder = await memberPage(browser, 'project-interest', { name: 'Marc Lefèvre' });
    await funder.page.goto(`/fr/projects/${project.slug}`);
    await hydrated(funder.page);
    await funder.page.getByRole('button', { name: 'Manifester un intérêt' }).first().click();
    const dialog = funder.page.getByRole('dialog', { name: 'Manifester un intérêt' });
    await dialog.getByRole('radio', { name: /Subvention/ }).check();
    await dialog
      .getByLabel('Message')
      .fill('Notre fondation finance des projets solaires au Sénégal.');
    await dialog.getByLabel('Montant indicatif').fill('15000');
    await dialog.getByRole('button', { name: 'Envoyer' }).click();
    await expect(dialog).toBeHidden();

    await owner.page.goto(`/fr/projects/${project.slug}/manage?tab=interests`);
    const item = owner.page.locator('[data-interest="grant"]');
    await expect(
      item.getByText('Notre fondation finance des projets solaires au Sénégal.'),
    ).toBeVisible();
    await expect(item.getByText('Marc Lefèvre')).toBeVisible();
    await expect(item.getByText(/15\s000\s€/)).toBeVisible();
    await owner.context.close();
    await funder.context.close();
  });

  test('the filters and the sort of the showcase live in the address', async ({ page }) => {
    await page.goto('/fr/projects');
    await hydrated(page);
    // The address changes at once, then the server renders the grid again in a transition: each
    // step waits for that render, which a navigation would otherwise interrupt.
    const rendered = async () => {
      await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
      await page.waitForLoadState('networkidle');
    };
    await choose(page, 'Statut', 'En financement');
    await page.waitForURL(/status=funding/);
    await rendered();
    await choose(page, 'Trier par', 'Fin de campagne proche');
    await page.waitForURL(/sort=ending_soon/);
    await rendered();
    await expect(page).toHaveURL(
      /status=funding.*sort=ending_soon|sort=ending_soon.*status=funding/,
    );
    await page.goto('/fr/projects?status=closed&country=GW');
    await expect(
      page.getByRole('heading', { name: 'Aucun projet ne correspond à ces filtres' }),
    ).toBeVisible();
    await hydrated(page);
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click();
    await page.waitForURL((url) => !url.search.includes('status='));
  });

  test('the amounts lock once a contribution is paid at the simulated provider', async ({
    browser,
  }) => {
    test.slow();
    // The demonstration holder can collect (payout account and KYC of `pnpm db:seed:dev`).
    const holder = await demoPage(browser, 'aissatou.ba@demo.pitchorium.test');
    const project = await apiProject(holder.page, `Verrou ${Date.now()}`, { goal: 8_000 });
    const contributor = await memberPage(browser, 'project-contributor', { name: 'Léa Martin' });
    const contribution = (await (
      await ok(
        api(contributor.page, 'POST', `/v1/projects/${project.id}/contributions`, {
          kind: 'donation',
          amount: eur(30),
          method: 'card',
          publicDisplay: true,
        }),
      )
    ).json()) as { id: string; paymentUrl: string };
    await ok(contributor.page.request.post(`${contribution.paymentUrl}/succeed`));
    await expect
      .poll(async () => {
        const reply = await api(contributor.page, 'GET', `/v1/me/contributions/${contribution.id}`);
        return ((await reply.json()) as { status: string }).status;
      })
      .toBe('succeeded');

    await holder.page.goto(`/fr/projects/${project.slug}/edit/funding`);
    await hydrated(holder.page);
    await expect(holder.page.getByLabel('Objectif')).toBeDisabled();
    await expect(
      holder.page.getByText(/Verrouillé depuis la première contribution payée/).first(),
    ).toBeVisible();
    await expect(holder.page.getByLabel('Durée de la campagne')).toBeDisabled();
    await expect(
      holder.page.getByText('Fixée à la publication : une campagne ne se prolonge pas.'),
    ).toBeVisible();
    // The texts stay editable.
    await expect(holder.page.getByLabel('Usage des fonds').first()).toBeEditable();
    await holder.context.close();
    await contributor.context.close();
  });

  test('a member joins the team by an invitation, then leaves it', async ({ browser }) => {
    const owner = await entrepreneur(browser, 'project-team-owner', 'Ibrahima Ba');
    const title = `Équipe solaire ${Date.now()}`;
    const project = await apiProject(owner.page, title);
    const invitee = await memberPage(browser, 'project-team', { name: 'Aminata Touré' });

    await owner.page.goto(`/fr/projects/${project.slug}/manage?tab=team`);
    await hydrated(owner.page);
    await owner.page.getByLabel('Identifiant du membre').fill(invitee.member.handle);
    await owner.page.getByLabel('Fonction affichée').fill('Responsable des ventes');
    await owner.page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
    await expect(owner.page.getByText('Invitations en attente')).toBeVisible();
    await expect(
      owner.page.getByText('Un projet garde toujours au moins un propriétaire').first(),
    ).toBeVisible();

    await invitee.page.goto('/fr/projects');
    await hydrated(invitee.page);
    const invitation = invitee.page
      .getByRole('region', { name: 'Invitations à rejoindre une équipe' })
      .or(invitee.page.locator('section', { hasText: 'Invitations à rejoindre une équipe' }));
    await invitation.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
    await expect(
      invitation.getByText('Cochez le consentement pour rejoindre l’équipe.'),
    ).toBeVisible();
    await invitation.getByRole('checkbox').check();
    await invitation.getByRole('button', { name: 'Rejoindre l’équipe' }).click();
    await invitee.page.waitForURL(new RegExp(`/fr/projects/${project.slug}$`));
    await expect(invitee.page.getByText('Aminata Touré').first()).toBeVisible();

    await invitee.page.goto(`/fr/projects/${project.slug}/manage?tab=team`);
    await hydrated(invitee.page);
    await invitee.page.getByRole('button', { name: 'Quitter l’équipe' }).click();
    await invitee.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Quitter l’équipe' })
      .click();
    await invitee.page.waitForURL(new RegExp(`/fr/projects/${project.slug}$`));
    await owner.page.reload();
    await expect(owner.page.getByText('Aminata Touré')).toHaveCount(0);
    await owner.context.close();
    await invitee.context.close();
  });

  test('an entrepreneur assesses the impact of their activity and finds its history', async ({
    browser,
  }) => {
    const { page, context } = await entrepreneur(browser, 'impact-facet', 'Rokhaya Gueye');
    await page.goto('/fr/profile/impact');
    await hydrated(page);
    await expect(page.getByText(/Méthodologie DEMO, non contractuelle, version \d+/)).toBeVisible();
    await expect(page.getByRole('radiogroup').first()).toBeVisible();
    for (const group of await page.getByRole('radiogroup').all()) {
      await group.getByRole('radio').first().check();
    }
    await page.getByRole('button', { name: 'Enregistrer l’évaluation' }).click();
    await expect(page.getByTestId('impact-score')).toContainText('Score actuel : 0 sur 100');
    await expect(
      page
        .getByRole('region')
        .or(page.locator('section'))
        .filter({ hasText: 'Historique' })
        .first(),
    ).toContainText('0 sur 100');
    await page.getByRole('link', { name: 'Voir la méthodologie de l’impact' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Méthodologie de l’impact' }),
    ).toBeVisible();
    await context.close();
  });

  test('the pages of a project have no axe violation', async ({ browser }) => {
    const owner = await entrepreneur(browser, 'project-axe', 'Nafi Cissé');
    const project = await apiProject(owner.page, `Accessible ${Date.now()}`);
    for (const path of [
      `/fr/projects/${project.slug}`,
      `/fr/projects/${project.slug}/edit/funding`,
      `/fr/projects/${project.slug}/manage`,
      '/fr/projects',
    ]) {
      await owner.page.goto(path);
      await hydrated(owner.page);
      const results = await new AxeBuilder({ page: owner.page }).analyze();
      expect(results.violations, path).toEqual([]);
    }
    await owner.context.close();
  });
});
