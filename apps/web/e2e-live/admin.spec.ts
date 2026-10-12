import AxeBuilder from '@axe-core/playwright';
import { ageSession, DATABASE_URL } from './database';
import {
  ADMIN_EMAIL,
  adminPage,
  allowConsole,
  api,
  expect,
  freshStaffPage,
  hydrated,
  memberPage,
  ok,
  reauthenticate,
  test,
} from './support';

/**
 * The console of the administration against the real api (PROMPT FRONT 9A): no console without a
 * role, a role granted from the file of a member after a new sign-in, a methodology published
 * from its draft and read on the public page, the guardrails of the flags, a failed job retried
 * once, a discrepancy of the reconciliation noted as handled. The moderation, the verification of
 * the organisations and the payments of the console run in trust, organizations and payments.
 */
test.describe('console of the administration', () => {
  test('a member without a role finds no console', async ({ browser }) => {
    allowConsole(/status of 404 \(Not Found\)/);
    const { page, context } = await memberPage(browser, 'no-console', { name: 'Awa Ndiaye' });
    const response = await page.goto('/fr/admin');
    expect(response?.status()).toBe(404);
    expect((await api(page, 'GET', '/v1/admin/capabilities')).status()).toBe(403);
    await context.close();
  });

  test('a role granted from the file of a member, after a new sign-in', async ({ browser }) => {
    test.skip(!DATABASE_URL, 'The session is aged in the database of the run.');
    // The api refuses the old session on purpose.
    allowConsole(/status of 403 \(Forbidden\) \(\S+\/roles/);
    const admin = await freshStaffPage(browser, ADMIN_EMAIL, 'admin');
    test.skip(!admin, 'The administrator of the run (demonstration data).');
    const member = await memberPage(browser, 'granted', { name: 'Ousmane Diallo' });
    const userId = (
      (await (await ok(api(member.page, 'GET', '/v1/me'))).json()) as { user: { id: string } }
    ).user.id;
    await ageSession(admin!.context);

    const page = admin!.page;
    await page.goto(`/fr/admin/members/${userId}`);
    await hydrated(page);
    await expect(
      page.getByText(/votre consultation est inscrite au journal d’audit/),
    ).toBeVisible();
    const grant = async () => {
      await page.getByRole('button', { name: 'Attribuer le rôle' }).click();
      await page
        .getByRole('alertdialog', { name: /Attribuer le rôle Modérateur/ })
        .getByRole('button', { name: 'Attribuer le rôle' })
        .click();
    };
    await grant();
    await expect(page.getByText('Reconnectez-vous pour continuer')).toBeVisible();
    await reauthenticate(page, ADMIN_EMAIL, 'admin');
    await hydrated(page);
    // Back on the file, the grant open again: confirmed this time with a recent session.
    await page
      .getByRole('alertdialog', { name: /Attribuer le rôle Modérateur/ })
      .getByRole('button', { name: 'Attribuer le rôle' })
      .click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Rôle Modérateur attribué.');
    const roles = (await (
      await ok(api(page, 'GET', `/v1/admin/members/${userId}/roles`))
    ).json()) as { assignments: { role: string }[] };
    expect(roles.assignments.map((item) => item.role)).toContain('moderator');
    // Granting a role closes the sessions of the member.
    expect((await api(member.page, 'GET', '/v1/me')).status()).toBe(401);
    const audit = await new AxeBuilder({ page }).include('main').analyze();
    expect(audit.violations).toEqual([]);
    await Promise.all([admin!.context.close(), member.context.close()]);
  });

  test('a methodology published from its draft becomes the public one', async ({ browser }) => {
    const admin = await adminPage(browser);
    test.skip(!admin, 'The administrator of the run (demonstration data).');
    const page = admin!.page;
    await page.goto('/fr/admin/impact');
    await hydrated(page);
    await page.getByRole('button', { name: /Nouveau brouillon à partir de la v/ }).click();
    await expect(page).toHaveURL(/\/fr\/admin\/impact\/[\w-]+$/);
    await hydrated(page);
    const name = `Méthodologie de démonstration ${Date.now()}`;
    await page.getByLabel('Nom de la version').fill(name);
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Brouillon enregistré.');
    await expect(
      page.getByText(/Chaque critère, description et niveau a son libellé/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Calculer le score' }).click();
    await expect(page.getByText('sur 100')).toBeVisible();
    await page.getByRole('button', { name: 'Publier la version' }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm.getByText(/ne se modifie plus jamais/)).toBeVisible();
    await confirm.getByRole('textbox').fill('PUBLIER');
    await confirm.getByRole('button', { name: 'Publier la version' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Version publiée.');

    await page.goto('/fr/impact/methodology');
    await expect(page.getByText(new RegExp(name))).toBeVisible();
    await admin!.context.close();
  });

  test('an incomplete language and equity without a legal reference stay off', async ({
    browser,
  }) => {
    const admin = await adminPage(browser);
    test.skip(!admin, 'The administrator of the run (demonstration data).');
    const page = admin!.page;
    await page.goto('/fr/admin/flags');
    await hydrated(page);
    const wolof = page.locator('[aria-labelledby="flag-locale.wo"]');
    await expect(wolof.getByRole('button', { name: 'Activer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // The api refuses the activation whatever the screen offers.
    const refused = await api(page, 'PATCH', '/v1/admin/feature-flags/locale.wo', {
      enabled: true,
      legalReference: null,
    });
    expect(((await refused.json()) as { code: string }).code).toBe('LOCALIZATION_LOCALE_NOT_READY');
    const equity = page.locator('[aria-labelledby="flag-funding.equity"]');
    await expect(equity.getByText(/n’accepte aucun paiement en ligne/)).toBeVisible();
    await equity.getByRole('button', { name: 'Activer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Activer funding.equity ?' });
    await expect(dialog.getByRole('button', { name: 'Activer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const withoutReference = await api(page, 'PATCH', '/v1/admin/feature-flags/funding.equity', {
      enabled: true,
      legalReference: null,
    });
    expect(((await withoutReference.json()) as { code: string }).code).toBe(
      'ADMIN_LEGAL_REFERENCE_REQUIRED',
    );
    await admin!.context.close();
  });

  test('a failed job retried once from the console', async ({ browser }) => {
    const admin = await freshStaffPage(browser, ADMIN_EMAIL, 'admin');
    test.skip(!admin, 'The administrator of the run (demonstration data).');
    const page = admin!.page;
    const job = page.locator(
      '[aria-labelledby="job-trust.moderation-demo-refund-of-a-missing-contribution"]',
    );
    // The worker runs the job of the demonstration data once, and it fails for good.
    await expect(async () => {
      await page.goto('/fr/admin/jobs');
      await expect(job).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await expect(job.getByText('"reason": "[redacted]"')).toBeVisible();
    await job.getByRole('button', { name: 'Relancer' }).click();
    await page
      .getByRole('alertdialog', { name: 'Relancer refund ?' })
      .getByRole('button', { name: 'Relancer' })
      .click();
    await expect(job.getByRole('status')).toHaveText('Tâche relancée.');
    await expect(job.getByRole('button', { name: 'Relancer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // The job fails again (its contribution does not exist): one job, never a copy.
    await expect(async () => {
      const failed = (await (
        await ok(api(page, 'GET', '/v1/admin/jobs/failed?queue=trust.moderation'))
      ).json()) as { items: { id: string; attemptsMade: number }[] };
      const same = failed.items.filter(
        (item) => item.id === 'demo-refund-of-a-missing-contribution',
      );
      expect(same).toHaveLength(1);
      expect(same[0]!.attemptsMade).toBeGreaterThanOrEqual(2);
    }).toPass({ timeout: 60_000 });
    await admin!.context.close();
  });

  test('a discrepancy of the reconciliation noted as handled', async ({ browser }) => {
    const admin = await adminPage(browser);
    test.skip(!admin, 'The administrator of the run (demonstration data).');
    const page = admin!.page;
    await page.goto('/fr/admin/payments/discrepancies');
    await hydrated(page);
    const discrepancy = page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ hasText: 'sim_pi_demo_amount_mismatch' });
    await expect(discrepancy).toContainText('5000 EUR');
    await discrepancy.getByRole('button', { name: 'Noter comme traité' }).click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByLabel('Note')
      .fill('Frais du prestataire déduits du montant ; écart expliqué, rien à corriger.');
    await dialog.getByRole('button', { name: 'Noter comme traité' }).click();
    await expect(page.locator('[data-announcer="polite"]')).toHaveText('Écart noté comme traité.');
    await page.getByRole('button', { name: 'Résolu' }).click();
    await expect(page.getByText(/Frais du prestataire déduits/)).toBeVisible();
    await admin!.context.close();
  });
});
