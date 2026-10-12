import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { allowConsole, API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

/**
 * The console of the administration (PROMPT FRONT 9A) against the stub api
 * (e2e/support/stub-admin.mjs): what an administrator and a moderator see, the appeal of one's
 * own decision refused, a partial refund after a new sign-in, the guardrails of the flags, a
 * methodology published once its labels are complete, a failed job retried once, the audit log
 * filtered in the address, and axe on every screen in both themes.
 */
const ADMIN = 'claudine.pierre.louis@demo.pitchorium.test';
const MODERATOR = 'koffi.agbodjan@demo.pitchorium.test';
const ID = (n: number) => `0192f4a0-9000-7000-8000-${String(n).padStart(12, '0')}`;

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

async function stubState(context: BrowserContext, name: string): Promise<void> {
  await context.addCookies([{ name, value: '1', url: API_ORIGIN }]);
}

function nav(page: Page) {
  return page.getByRole('complementary', { name: 'Administration' });
}

test.describe('console of the administration', () => {
  test('opens to an administrator with every queue, the figures and each screen', async ({
    page,
  }) => {
    await signIn(page, ADMIN);
    await page.goto('/fr/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeVisible();
    for (const queue of [
      'Signalements',
      'Appels',
      'Écarts de rapprochement',
      'Demandes de droits',
    ]) {
      await expect(
        page.getByRole('main').getByRole('link', { name: new RegExp(queue) }),
      ).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'La plateforme' })).toBeVisible();
    for (const item of [
      'Contributions',
      'Méthodologies d’impact',
      'Tâches en échec',
      'Journal d’audit',
    ]) {
      await expect(nav(page).getByRole('link', { name: item })).toBeVisible();
    }
    await page
      .getByRole('main')
      .getByRole('link', { name: /Écarts de rapprochement/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rapprochement' })).toBeVisible();
    await expect(page.getByText('sim_pi_demo_amount_mismatch')).toBeVisible();
  });

  test('hides from a moderator what only an administrator does', async ({ page }) => {
    allowConsole(/status of 404 \(Not Found\)/);
    await signIn(page, MODERATOR);
    await page.goto('/fr/admin');
    await expect(
      page.getByText('Les chiffres de la plateforme sont réservés aux administrateurs.'),
    ).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Modération' })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Contributions' })).toHaveCount(0);
    await expect(nav(page).getByRole('link', { name: 'Journal d’audit' })).toHaveCount(0);
    // The screen does not exist for this reader (streamed after the shell, so the not-found view).
    await page.goto('/fr/admin/payments/contributions');
    await expect(page.getByRole('heading', { name: 'Cette page n’existe pas.' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    // A project is frozen by an administrator only: the option says why.
    await page.goto(`/fr/admin/moderation/cases/${ID(803)}`);
    const freeze = page.getByRole('radio', { name: /Gel du projet/ });
    await expect(freeze).toBeDisabled();
    await expect(freeze).toHaveAccessibleName(/réservée aux administrateurs/);
  });

  test('refuses a moderator the appeal of their own decision, and lets the other resolve it', async ({
    page,
    request,
  }) => {
    await signIn(page, MODERATOR);
    await page.goto('/fr/admin/moderation/appeals');
    const own = page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ hasText: 'rendement garanti' });
    await expect(own.getByText(/Vous avez pris cette décision/)).toBeVisible();
    await expect(own.getByRole('button', { name: 'Trancher l’appel' })).toHaveCount(0);
    const other = page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ hasText: 'Des invitations identiques' });
    await other.getByRole('button', { name: 'Trancher l’appel' }).click();
    const dialog = page.getByRole('dialog', { name: 'Trancher l’appel' });
    await dialog.getByRole('radio', { name: /Annuler la décision/ }).check();
    await dialog
      .getByLabel('Motivation')
      .fill('Les invitations suivaient un salon où les membres avaient échangé leurs cartes.');
    await dialog.getByRole('button', { name: 'Enregistrer la décision finale' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Appel tranché.');
    const writes = await stub(request).writes();
    expect(writes.filter((write) => write.route === 'appeal-resolve')).toEqual([
      expect.objectContaining({ email: MODERATOR, outcome: 'overturned' }),
    ]);
  });

  test('refunds part of a contribution once the effect is seen, after a recent sign-in', async ({
    page,
    context,
    request,
  }) => {
    allowConsole(/status of 403 \(Forbidden\) \(\S+\/refunds/);
    await signIn(page, ADMIN);
    await stubState(context, 'stub-stale');
    await page.goto(`/fr/admin/payments/contributions/${ID(501)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Paiement reçu', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Encore remboursable : 100,00 €.')).toBeVisible();
    const refund = page
      .getByRole('region', { name: 'Rembourser' })
      .or(page.locator('[aria-labelledby="refund-title"]'));
    await refund.getByRole('button', { name: 'Une partie' }).click();
    await refund.getByLabel('Montant à rembourser').fill('30');
    await refund.getByLabel('Motif').fill('Demande du contributeur, doublon de paiement.');
    const submit = refund.getByRole('button', { name: 'Rembourser' });
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await refund.getByRole('button', { name: 'Voir l’effet' }).click();
    await expect(refund.getByText('Commission rendue')).toBeVisible();
    await expect(refund.getByText('1,50 €')).toBeVisible();
    await submit.click();
    const confirm = page.getByRole('alertdialog', { name: /Rembourser 30,00 € \?/ });
    await confirm.getByRole('textbox').fill('REMBOURSER');
    await confirm.getByRole('button', { name: 'Rembourser' }).click();
    // The session is too old: the notice leads to a new sign-in that comes back here.
    const again = page.getByRole('link', { name: 'Se reconnecter' });
    await expect(again).toBeVisible();
    const back = new URL((await again.getAttribute('href')) ?? '', 'http://web').searchParams.get(
      'redirectTo',
    );
    expect(back).toContain(`resume=refund%3A${ID(501)}`);
    await context.clearCookies({ name: 'stub-stale' });
    await page.goto(back ?? '');
    await page.waitForLoadState('networkidle');
    // Nothing of the refund is kept in the browser: the panel asks for it again.
    await expect(refund.getByText(/Connexion renouvelée/)).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await refund.getByRole('button', { name: 'Une partie' }).click();
    await refund.getByLabel('Montant à rembourser').fill('30');
    await refund.getByLabel('Motif').fill('Demande du contributeur, doublon de paiement.');
    await refund.getByRole('button', { name: 'Voir l’effet' }).click();
    await submit.click();
    const confirmAgain = page.getByRole('alertdialog', { name: /Rembourser 30,00 € \?/ });
    await confirmAgain.getByRole('textbox').fill('REMBOURSER');
    await confirmAgain.getByRole('button', { name: 'Rembourser' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Remboursement demandé.');
    const refunds = (await stub(request).writes()).filter((write) => write.route === 'refund');
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.['key']).toEqual(expect.any(String));
  });

  test('keeps an incomplete language off and equity without its legal reference', async ({
    page,
  }) => {
    await signIn(page, ADMIN);
    await page.goto('/fr/admin/flags');
    const wolof = page.locator('[aria-labelledby="flag-locale.wo"]');
    await expect(
      wolof.getByText(/relecture humaine native de cette langue n’est pas enregistrée/).first(),
    ).toBeVisible();
    await expect(wolof.getByRole('button', { name: 'Activer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const equity = page.locator('[aria-labelledby="flag-funding.equity"]');
    await expect(equity.getByText(/n’accepte aucun paiement en ligne/)).toBeVisible();
    await equity.getByRole('button', { name: 'Activer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Activer funding.equity ?' });
    await expect(dialog.getByText(/sans adaptateur agréé/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Activer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(dialog.getByRole('button', { name: 'Activer' })).toHaveAccessibleDescription(
      /référence de la validation juridique/,
    );
  });

  test('publishes a draft methodology once each active language has its labels', async ({
    page,
    request,
  }) => {
    await signIn(page, ADMIN);
    await page.goto(`/fr/admin/impact/${ID(401)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Libellés manquants\s: 5/)).toBeVisible();
    const publish = page.getByRole('button', { name: 'Publier la version' });
    await expect(publish).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('tab', { name: /English/ }).click();
    const water = page.getByRole('listitem').filter({ hasText: /Critère 4/ });
    await water.getByLabel('Libellé (English)').first().fill('Water access');
    await water.getByLabel('Description (English)').fill('Water access: what the holder declares.');
    const levels = water.getByLabel('Libellé (English)');
    for (const [index, label] of [
      [1, 'None'],
      [2, 'In part'],
      [3, 'Fully'],
    ] as const) {
      await levels.nth(index).fill(label);
    }
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect(
      page.getByText(/Chaque critère, description et niveau a son libellé/),
    ).toBeVisible();
    await publish.click();
    const confirm = page.getByRole('alertdialog', { name: 'Publier la v2 ?' });
    await expect(confirm.getByText(/ne se modifie plus jamais/)).toBeVisible();
    await confirm.getByRole('textbox').fill('PUBLIER');
    await confirm.getByRole('button', { name: 'Publier la version' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Version publiée.');
    const writes = await stub(request).writes();
    expect(writes.map((write) => write.route)).toEqual(
      expect.arrayContaining(['methodology-update', 'methodology-publish']),
    );
  });

  test('retries a failed job once, its payload masked', async ({ page, request }) => {
    await signIn(page, ADMIN);
    await page.goto('/fr/admin/jobs');
    const job = page.locator(
      '[aria-labelledby="job-trust.moderation-demo-refund-of-a-missing-contribution"]',
    );
    await expect(job.getByText('"reason": "[redacted]"')).toBeVisible();
    await job.getByRole('button', { name: 'Relancer' }).click();
    await page
      .getByRole('alertdialog', { name: 'Relancer refund ?' })
      .getByRole('button', { name: 'Relancer' })
      .click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Tâche relancée.');
    // Retried, the job leaves the failed jobs.
    await expect(job).toHaveCount(0);
    const retries = (await stub(request).writes()).filter((write) => write.route === 'job-retry');
    expect(retries).toHaveLength(1);
  });

  test('filters the audit log in the address and exports it', async ({ page, request }) => {
    await signIn(page, ADMIN);
    await page.goto('/fr/admin/audit');
    // The filters are read once the page answers (hydrated).
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Ces données sont personnelles', { exact: false })).toBeVisible();
    await page.getByLabel('Action').fill('payments');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(page).toHaveURL(/\?action=payments/);
    await expect(page.getByRole('row')).toHaveCount(3);
    await page.getByRole('row').nth(1).getByRole('button', { name: 'Ouvrir' }).click();
    await expect(page.getByRole('dialog').getByText('"amount": "1000.00 EUR"')).toBeVisible();
    await page.keyboard.press('Escape');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter en CSV' }).click();
    expect((await download).suggestedFilename()).toBe('audit-log.csv');
    const writes = await stub(request).writes();
    expect(writes.filter((write) => write.route === 'audit-export')).toHaveLength(1);
  });
});

test.describe('console of the administration, its accessibility', () => {
  const SCREENS = [
    '/fr/admin',
    '/fr/admin/moderation',
    `/fr/admin/moderation/cases/${ID(802)}`,
    '/fr/admin/moderation/appeals',
    '/fr/admin/organizations',
    `/fr/admin/members/${ID(1)}`,
    `/fr/admin/payments/contributions/${ID(502)}`,
    '/fr/admin/payments/offline',
    `/fr/admin/payments/kyc/${ID(101)}`,
    '/fr/admin/payments/discrepancies',
    `/fr/admin/impact/${ID(401)}`,
    '/fr/admin/flags',
    '/fr/admin/highlights',
    '/fr/admin/jobs',
    '/fr/admin/privacy',
    '/fr/admin/audit',
  ];
  // One test per screen and theme: sixteen screens in one test outlast its time in Firefox and
  // WebKit on the runner.
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const screen of SCREENS) {
      test(`has no axe violation on ${screen} in the ${colorScheme} theme`, async ({ browser }) => {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await signIn(page, ADMIN);
        await page.goto(screen);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.length}`)).toEqual([]);
        await context.close();
      });
    }
  }
});
