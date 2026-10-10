import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import {
  adminPage,
  api,
  apiProject,
  choose,
  demoPage,
  entrepreneur,
  eur,
  expect,
  hydrated,
  linkFromInbox,
  memberPage,
  ok,
  pngImage,
  test,
} from './support';

const HOLDER = 'aissatou.ba@demo.pitchorium.test';
const GRACE_PROJECT = '/fr/projects/kiosques-d-eau-potable-a-kisumu';

interface Journey {
  kind: RegExp;
  amount: string;
  reward?: RegExp;
  country?: string;
  /** In the name of this organisation. */
  organization?: string;
  method?: RegExp;
}

/** The dialog of the journey and its button to the next step. */
function journey(page: Page) {
  const dialog = page.getByTestId('contribute-dialog');
  return {
    dialog,
    reach: async (step: string) => {
      if ((await dialog.getAttribute('data-step')) !== step) {
        await dialog.getByRole('button', { name: 'Continuer' }).click();
      }
      await expect(dialog).toHaveAttribute('data-step', step);
    },
  };
}

/** Walks the journey of a contribution from « Contribuer » to its quote. */
async function toQuote(page: Page, path: string, choices: Journey): Promise<Locator> {
  await page.goto(path);
  await hydrated(page);
  await page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }).click();
  const { dialog, reach } = journey(page);
  await expect(dialog).toHaveAttribute('data-step', 'kind');
  await dialog.getByRole('radio', { name: choices.kind }).click();
  await reach('country');
  if (choices.country)
    await choose(dialog, 'Pays d’où vous payez', choices.country, choices.country);
  await reach('amount');
  await dialog.getByRole('textbox', { name: /Montant/ }).fill(choices.amount);
  if (choices.reward) {
    await reach('reward');
    await dialog.getByRole('radio', { name: choices.reward }).click();
    await expect(dialog.getByRole('button', { name: 'Continuer' })).toBeEnabled();
  }
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await expect(dialog).toHaveAttribute('data-step', /^(behalf|display)$/);
  if ((await dialog.getAttribute('data-step')) === 'behalf') {
    if (choices.organization)
      await dialog.getByRole('radio', { name: choices.organization }).click();
    await reach('display');
  }
  await expect(dialog).toHaveAttribute('data-step', 'display');
  await reach('method');
  await dialog.getByRole('radio', { name: choices.method ?? /Carte bancaire/ }).click();
  await reach('review');
  await expect(dialog.getByTestId('quote-summary')).toBeVisible();
  return dialog;
}

/** Pays on the page of the simulated provider with a scenario, then comes back. */
async function payAtProvider(page: Page, dialog: Locator, scenario: 'succeed' | 'fail' | 'expire') {
  await Promise.all([
    page.waitForURL(/\/v1\/payments\/simulated\/checkout\//),
    dialog.getByTestId('pay').click(),
  ]);
  await page.getByRole('button', { name: scenario, exact: true }).click();
  await page.getByRole('link', { name: 'Retour au site' }).click();
  await page.waitForURL(/\/contributions\/[\w-]+\/return$/);
}

/** Contributions of a project created by the demonstration holder, who collects already. */
async function holderProject(page: Page, title: string, tiers: number[]) {
  const project = await apiProject(page, `${title} ${Date.now()}`, {
    goal: tiers.at(-1)!,
    tiers,
    instruments: ['donation', 'reward_crowdfunding', 'love_money'],
  });
  await ok(
    api(page, 'POST', `/v1/projects/${project.id}/rewards`, {
      title: 'Carte de la coopérative',
      description: 'Une carte écrite par les maraîchères.',
      minAmount: eur(20),
      instruments: ['reward_crowdfunding'],
      quantity: 1,
      estimatedDelivery: null,
    }),
  );
  return project;
}

/** Contributions against the real api and its simulated provider (PROMPT FRONT 5B). */
test.describe('contributions', () => {
  test(
    'a contribution with a reward: quote, provider, return, tier unlocked, email, dashboard',
    { tag: '@critical' },
    async ({ browser }) => {
      test.slow();
      const holder = await demoPage(browser, HOLDER);
      const project = await holderProject(holder.page, 'Panneaux de Pout', [30, 1_000]);
      const { page, member, context } = await memberPage(browser, 'pay-reward', {
        name: 'Léa Martin',
        profile: { headline: 'Ingénieure', countryCode: 'FR' },
      });
      const dialog = await toQuote(page, `/fr/projects/${project.slug}`, {
        kind: /Crowdfunding avec contrepartie/,
        amount: '40',
        reward: /Carte de la coopérative/,
      });
      // The quote of the api: 5 % commission and the mentions of section 9.5, before paying.
      await expect(dialog.getByText('Commission de Pitchorium (5 %)')).toBeVisible();
      await expect(dialog.getByText('2,00 €')).toBeVisible();
      await expect(dialog.getByTestId('payment-mentions')).toContainText('palier débloqué');
      await payAtProvider(page, dialog, 'succeed');
      await expect(
        page.getByRole('heading', { name: 'Merci, votre contribution est confirmée' }),
      ).toBeVisible();
      await expect(page.getByTestId('paid-amount')).toHaveText('40,00 €');
      await expect(page.getByText(/Palier 1 débloqué/)).toBeVisible();
      await expect(page.getByText('Cette confirmation n’est pas un reçu fiscal.')).toBeVisible();
      await linkFromInbox(member.email, /reçu fiscal/);
      await page.goto('/fr/dashboard');
      await expect
        .poll(async () => {
          await page.reload();
          return page.getByTestId('engagement-stats').textContent();
        })
        .toMatch(/Versé ce mois-ci40\s€/);
      await expect(page.getByTestId('my-contributions')).toContainText('Payée');
      await holder.context.close();
      await context.close();
    },
  );

  test(
    'a holder established in Senegal opens a payout account in a covered country, then contributions open',
    { tag: '@critical' },
    async ({ browser }) => {
      test.slow();
      const admin = await adminPage(browser);
      test.skip(!admin, 'The administrator of the run (admin:create) reviews the identity check.');
      const holder = await entrepreneur(browser, 'payout-sn', 'Mariama Faye', {
        profile: { headline: 'Fondatrice', countryCode: 'SN' },
      });
      const project = await apiProject(holder.page, `Moulins de Fatick ${Date.now()}`);
      const visitor = await memberPage(browser, 'payout-visitor', { name: 'Paul Mendy' });
      await visitor.page.goto(`/fr/projects/${project.slug}`);
      await expect(visitor.page.getByTestId('contribute-entry')).toContainText(
        'Les contributions en ligne ne sont pas encore disponibles pour ce projet.',
      );

      const page = holder.page;
      await page.goto('/fr/settings/payouts');
      await hydrated(page);
      await expect(page.getByText(/Ce qui compte est le pays du compte bancaire/)).toBeVisible();
      const choice = page.getByTestId('payout-choice');
      // Senegal is not a covered payout country: said honestly, with what remains possible.
      await choose(choice, 'Pays de votre compte bancaire', 'Sénégal', 'Sénégal');
      await expect(
        choice.getByText(/Aucune option couverte pour un compte dans ce pays/),
      ).toBeVisible();
      await choose(choice, 'Pays de votre compte bancaire', 'France', 'France');
      await expect(choice.getByTestId('payout-option')).toContainText(
        'Un compte bancaire dans le pays du compte',
      );
      await choice.getByLabel('Titulaire du compte').fill('Mariama Faye');
      await choice.getByLabel('Code de la banque').fill('30004');
      await choice.getByLabel('Numéro de compte').fill('FR76 3000 4000 0312 3456 7890 143');
      await choice.getByRole('checkbox', { name: /Je confirme remplir les conditions/ }).check();
      await choice.getByRole('button', { name: 'Vérifier avant l’envoi' }).click();
      await expect(choice.getByTestId('bank-review')).toContainText('0143');
      await expect(choice.getByTestId('bank-review')).not.toContainText('3456 7890');
      await choice.getByRole('button', { name: 'Ouvrir mon compte de versement' }).click();
      await expect(page.getByTestId('payout-account')).toContainText('France');

      // The identity check by the manual review of Pitchorium, on a private document.
      const kyc = page.getByTestId('kyc-section');
      await kyc.locator('input[type="file"]').setInputFiles(await pngImage(page, 800, 800));
      await kyc.getByRole('checkbox', { name: /Je certifie/ }).check();
      await expect(kyc.getByRole('button', { name: 'Envoyer pour vérification' })).toBeEnabled({
        timeout: 60_000,
      });
      await kyc.getByRole('button', { name: 'Envoyer pour vérification' }).click();
      await expect(kyc).toContainText('Vos pièces sont en cours d’examen');
      await visitor.page.reload();
      await expect(visitor.page.getByTestId('contribute-entry')).toContainText(
        'Les contributions en ligne ouvriront dès que le porteur aura finalisé sa vérification.',
      );

      const queue = (await (
        await ok(
          api(admin!.page, 'GET', '/v1/admin/payments/kyc-submissions?status=pending&limit=100'),
        )
      ).json()) as { items: { id: string; holder: { handle: string } | null }[] };
      const submission = queue.items.find((item) => item.holder?.handle === holder.member.handle);
      await ok(
        api(admin!.page, 'POST', `/v1/admin/payments/kyc-submissions/${submission!.id}/decision`, {
          decision: 'approved',
          reason: 'Pièce d’identité lisible et conforme.',
        }),
      );
      await visitor.page.reload();
      await expect(
        visitor.page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }),
      ).toBeVisible();
      await admin!.context.close();
      await holder.context.close();
      await visitor.context.close();
    },
  );

  test(
    'a project whose holder has no covered payout account says so and offers the alternatives',
    { tag: '@critical' },
    async ({ browser }) => {
      const { page, context } = await memberPage(browser, 'no-cover', { name: 'Inès Diallo' });
      await page.goto(GRACE_PROJECT);
      await hydrated(page);
      const entry = page.getByTestId('contribute-entry');
      await expect(entry).toContainText('Contributions en ligne indisponibles');
      await expect(entry).toContainText(
        'Les contributions en ligne ne sont pas encore disponibles pour ce projet.',
      );
      await expect(
        entry.getByRole('button', { name: 'Prendre un engagement de love money' }),
      ).toBeVisible();
      await expect(entry.getByRole('button', { name: 'Manifester un intérêt' })).toBeVisible();
      await expect(entry.getByRole('button', { name: /hors plateforme/ })).toBeVisible();
      await expect(entry.getByRole('button', { name: 'Contribuer' })).toHaveCount(0);
      const audit = await new AxeBuilder({ page })
        .include('[data-testid="contribute-entry"]')
        .analyze();
      expect(audit.violations).toEqual([]);
      await context.close();
    },
  );

  test('a contributor whose usual method is not covered reads the reason and pays otherwise', async ({
    browser,
  }) => {
    const holder = await demoPage(browser, HOLDER);
    const project = await holderProject(holder.page, 'Puits de Mékhé', [30, 1_000]);
    const { page, context } = await memberPage(browser, 'method-unavailable', {
      name: 'Nadia Morel',
      profile: { headline: 'Analyste', countryCode: 'FR' },
    });
    await page.goto(`/fr/projects/${project.slug}`);
    await hydrated(page);
    await page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }).click();
    const { dialog, reach } = journey(page);
    await dialog.getByRole('radio', { name: /^Don/ }).click();
    await reach('country');
    await reach('amount');
    await dialog.getByRole('textbox', { name: /Montant/ }).fill('25');
    await reach('display');
    await reach('method');
    const unavailable = dialog.getByTestId('unavailable-methods');
    await expect(unavailable).toContainText('Mobile Money');
    await expect(unavailable).toContainText('n’est pas disponible depuis ce pays (France)');
    await expect(unavailable).toContainText('Accepté pour ce paiement : carte bancaire');
    await expect(dialog.getByRole('radio', { name: /Carte bancaire/ })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="contribute-dialog"]')
      .analyze();
    expect(audit.violations).toEqual([]);
    await holder.context.close();
    await context.close();
  });

  test('a failed payment is tried again with the same choices, and a double click pays once', async ({
    browser,
  }) => {
    test.slow();
    const holder = await demoPage(browser, HOLDER);
    const project = await holderProject(holder.page, 'Serres de Rufisque', [500, 1_000]);
    const { page, context } = await memberPage(browser, 'pay-retry', { name: 'Hugo Bernard' });
    let dialog = await toQuote(page, `/fr/projects/${project.slug}`, {
      kind: /^Don/,
      amount: '35',
    });
    await payAtProvider(page, dialog, 'fail');
    await expect(page.getByRole('heading', { name: 'Le paiement n’a pas abouti' })).toBeVisible();
    await expect(
      page.getByText('Aucun montant n’a été prélevé pour cette tentative.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Réessayer' }).click();
    dialog = journey(page).dialog;
    await expect(dialog).toHaveAttribute('data-step', 'review');
    await expect(dialog.getByTestId('quote-summary')).toContainText('35,00 €');
    // Two clicks at once: one contribution, one session at the provider.
    await Promise.all([
      page.waitForURL(/\/v1\/payments\/simulated\/checkout\//),
      dialog.getByTestId('pay').dblclick(),
    ]);
    const mine = (await (await ok(api(page, 'GET', '/v1/me/contributions?limit=10'))).json()) as {
      items: { status: string }[];
    };
    expect(mine.items.map((item) => item.status).sort()).toEqual(['failed', 'pending_payment']);
    await page.getByRole('button', { name: 'succeed', exact: true }).click();
    await page.getByRole('link', { name: 'Retour au site' }).click();
    await expect(
      page.getByRole('heading', { name: 'Merci, votre contribution est confirmée' }),
    ).toBeVisible();
    await holder.context.close();
    await context.close();
  });

  test('an expired session frees its reward, and a pending one is proposed again', async ({
    browser,
  }) => {
    test.slow();
    const holder = await demoPage(browser, HOLDER);
    const project = await holderProject(holder.page, 'Ruches de Kolda', [500, 1_000]);
    const reward = async () => {
      const read = (await (
        await ok(api(holder.page, 'GET', `/v1/projects/${project.id}`))
      ).json()) as {
        rewards: { available: number | null }[];
      };
      return read.rewards[0]!.available;
    };
    const { page, context } = await memberPage(browser, 'pay-expire', { name: 'Zoé Lambert' });
    const dialog = await toQuote(page, `/fr/projects/${project.slug}`, {
      kind: /Crowdfunding avec contrepartie/,
      amount: '20',
      reward: /Carte de la coopérative/,
    });
    await Promise.all([
      page.waitForURL(/\/v1\/payments\/simulated\/checkout\//),
      dialog.getByTestId('pay').click(),
    ]);
    // Reserved for the session: the only unit is no longer available.
    expect(await reward()).toBe(0);
    await page.goto(`/fr/projects/${project.slug}`);
    await expect(page.getByRole('button', { name: 'Reprendre le paiement' })).toBeVisible();
    await page.goBack();
    await page.getByRole('button', { name: 'expire', exact: true }).click();
    await page.getByRole('link', { name: 'Retour au site' }).click();
    await expect(
      page.getByRole('heading', { name: 'La session de paiement a expiré' }),
    ).toBeVisible();
    await expect.poll(reward).toBe(1);
    await holder.context.close();
    await context.close();
  });

  test('a contribution in the name of an organisation counts on its dashboard', async ({
    browser,
  }) => {
    test.slow();
    const holder = await demoPage(browser, HOLDER);
    const project = await holderProject(holder.page, 'Forages de Louga', [500, 1_000]);
    const { page, context } = await memberPage(browser, 'pay-organization', { name: 'Awa Ndiaye' });
    const name = `Collectif de Louga ${Date.now()}`;
    await ok(
      api(page, 'POST', '/v1/organizations', {
        name,
        structureType: 'ngo_association',
        countryCodes: ['SN'],
      }),
    );
    const dialog = await toQuote(page, `/fr/projects/${project.slug}`, {
      kind: /^Don/,
      amount: '45',
      organization: name,
    });
    await payAtProvider(page, dialog, 'succeed');
    await expect(
      page.getByRole('heading', { name: 'Merci, votre contribution est confirmée' }),
    ).toBeVisible();
    await page.goto('/fr/dashboard');
    await page.getByRole('link', { name }).click();
    await page.waitForURL(/organization=/);
    await expect
      .poll(async () => {
        await page.reload();
        return page.getByTestId('engagement-stats').textContent();
      })
      .toMatch(/Versé ce mois-ci45\s€/);
    await holder.context.close();
    await context.close();
  });

  test('a love money commitment without payment, and an off-platform cash contribution confirmed by the team', async ({
    browser,
  }) => {
    test.slow();
    const holder = await demoPage(browser, HOLDER);
    const project = await holderProject(holder.page, 'Vergers de Ziguinchor', [500, 1_000]);
    const { page, context } = await memberPage(browser, 'offline', { name: 'Fatou Kane' });
    await page.goto(`/fr/projects/${project.slug}`);
    await hydrated(page);
    await page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }).click();
    const { dialog, reach } = journey(page);
    await dialog.getByRole('radio', { name: /Engagement de love money, sans paiement/ }).click();
    await reach('review');
    await dialog.getByRole('button', { name: 'Déclarer mon engagement' }).click();
    await expect(dialog.getByText('Engagement déclaré')).toBeVisible();
    await dialog.getByRole('button', { name: 'Terminer' }).click();

    await page.getByRole('button', { name: /hors plateforme/ }).click();
    const declare = page.getByRole('dialog', { name: 'Déclarer une contribution hors plateforme' });
    await declare.getByRole('radio', { name: /Espèces/ }).click();
    await declare.getByRole('textbox', { name: 'Montant' }).fill('150');
    await declare.locator('input[type="file"]').setInputFiles(await pngImage(page, 800, 800));
    await expect(declare.getByRole('button', { name: 'Déclarer' })).toBeEnabled({
      timeout: 60_000,
    });
    await declare.getByRole('button', { name: 'Déclarer' }).click();
    await expect(declare).toBeHidden();

    await holder.page.goto(`/fr/projects/${project.slug}/manage?tab=offline`);
    const items = holder.page.getByTestId('offline-item');
    await expect(items).toHaveCount(2);
    const cash = items.filter({ hasText: 'Espèces' });
    await expect(cash).toContainText('150,00 €');
    await expect(cash.getByRole('button', { name: 'Pièce 1' })).toBeVisible();
    await cash.getByRole('button', { name: 'Confirmer' }).click();
    await holder.page.getByRole('radio', { name: 'Toutes' }).click();
    await expect(items.filter({ hasText: 'Espèces' })).toContainText('Confirmée');

    await page.goto('/fr/dashboard');
    const mine = page.getByTestId('my-offline');
    await expect(
      mine.getByTestId('offline-item').filter({ hasText: 'Engagement love money' }),
    ).toContainText('Déclarée');
    await expect(mine.getByTestId('offline-item').filter({ hasText: 'Espèces' })).toContainText(
      'Confirmée',
    );
    await holder.context.close();
    await context.close();
  });

  test('the team exports the contributions of its project as CSV', async ({ browser }) => {
    const holder = await demoPage(browser, HOLDER);
    await holder.page.goto(
      '/fr/projects/pompes-solaires-pour-les-maraicheres-de-thies/manage?tab=contributions',
    );
    await hydrated(holder.page);
    await expect(holder.page.getByRole('table')).toContainText('Kofi Mensah');
    const [download] = await Promise.all([
      holder.page.waitForEvent('download'),
      holder.page.getByRole('button', { name: 'Exporter en CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      'contributions-pompes-solaires-pour-les-maraicheres-de-thies.csv',
    );
    const csv = readFileSync(await download.path(), 'utf8');
    expect(csv.split('\n')[0]).toContain('commission');
    expect(csv).toContain('Kofi Mensah');
    await holder.page.getByRole('combobox', { name: 'Statut' }).click();
    await holder.page.getByRole('option', { name: 'Remboursée en partie' }).click();
    await expect(holder.page.getByRole('table')).toContainText('Remboursée en partie');
    const audit = await new AxeBuilder({ page: holder.page }).include('main').analyze();
    expect(audit.violations).toEqual([]);
    await holder.context.close();
  });

  test('shared time confirmed by its beneficiary shows on the dashboard of the mentor', async ({
    browser,
  }) => {
    const { page, context } = await memberPage(browser, 'time-log', { name: 'Omar Sy' });
    await page.goto('/fr/dashboard/time');
    await hydrated(page);
    await page.getByRole('button', { name: 'Déclarer des heures' }).click();
    const declare = page.getByRole('dialog', { name: 'Déclarer des heures' });
    await declare.getByRole('radio', { name: 'Un entrepreneur' }).click();
    await declare.getByLabel('Identifiant de l’entrepreneur').fill('aissatou-ba');
    await declare.getByLabel('Heures').fill('1');
    await declare.getByLabel('Minutes').fill('30');
    await declare
      .getByLabel('Ce que vous avez fait')
      .fill('Revue du plan de trésorerie de la coopérative.');
    await declare.getByRole('button', { name: 'Déclarer' }).click();
    await expect(page.getByTestId('time-entry').filter({ hasText: 'Aïssatou Ba' })).toContainText(
      'Déclaré',
    );

    const holder = await demoPage(browser, HOLDER);
    await holder.page.goto('/fr/dashboard/time');
    const received = holder.page.getByTestId('time-entry').filter({ hasText: 'Omar Sy' });
    await received.getByRole('button', { name: 'Confirmer' }).click();
    await expect(received).toContainText('Confirmé');

    await page.goto('/fr/dashboard');
    await expect(page.getByTestId('engagement-stats')).toContainText('dont 1 h 30 confirmées');
    const audit = await new AxeBuilder({ page }).include('main').analyze();
    expect(audit.violations).toEqual([]);
    await holder.context.close();
    await context.close();
  });
});
