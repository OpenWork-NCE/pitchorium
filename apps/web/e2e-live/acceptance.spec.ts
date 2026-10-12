import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import {
  adminPage,
  api,
  apiProject,
  entrepreneur,
  expect,
  hydrated,
  linkFromInbox,
  MODERATOR_STATE,
  ok,
  PASSWORD,
  pngImage,
  test,
} from './support';

/**
 * The acceptance test of the product (PROMPT FRONT 9B, part A), against the real api, with five
 * accounts: a visitor discovers the site and a project, signs up, accepts the terms and passes the
 * onboarding; a holder creates a project, her team publishes it, the administrator approves her
 * identity check in the console; the new member follows the project, contributes through the
 * simulated provider and sees the tier unlocked; the holder reads the notification, sees the
 * contribution and exports the CSV; both exchange messages in real time; a publication is
 * reported, moderated, and its appeal resolved by another moderator; the member exports their
 * data, schedules the deletion of their account, then cancels it.
 *
 * Without a mouse (B2): every gesture is a key. The visitor and the member reach their controls
 * with Tab (`tabTo`, the order of the page), then act with Enter or Space; elsewhere a control is
 * focused, then pressed (`press`). Level 3 only (`@acceptance`, docs/architecture/testing.md).
 */

/**
 * Tab from where the focus is until `target` (or a control inside it) holds it, then stop. Past
 * the last control of the page, a person tabs through the toolbar of the browser and comes back
 * to its first one: Chromium and WebKit do so in the tests, Firefox keeps the focus on the last
 * control, so the journey goes on from the skip link, the first control of every page.
 */
async function tabTo(page: Page, target: Locator, limit = 400): Promise<void> {
  await expect(target).toBeVisible();
  const marker = 'data-tab-before';
  for (let step = 0; step < limit; step += 1) {
    await page.evaluate((name) => document.activeElement?.setAttribute(name, ''), marker);
    await page.keyboard.press('Tab');
    const [reached, stayed] = await target.evaluate(
      (element, name) => [
        element === document.activeElement || element.contains(document.activeElement),
        document.activeElement?.hasAttribute(name) === true &&
          document.activeElement !== document.body,
      ],
      marker,
    );
    await page.evaluate((name) => {
      for (const element of document.querySelectorAll(`[${name}]`)) element.removeAttribute(name);
    }, marker);
    if (reached) return;
    if (stayed) await page.locator('a[href="#main"]').first().focus();
  }
  throw new Error(`Not reachable with Tab in ${limit} steps: ${String(target)}`);
}

/** Reaches a control with Tab, then presses a key on it. */
async function tabAndPress(page: Page, target: Locator, key = 'Enter'): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.press(key);
}

/** Reaches a field with Tab, then types into it. */
async function tabAndType(page: Page, target: Locator, text: string): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.type(text);
}

/** Focuses a control (no pointer), then presses a key on it. */
async function press(target: Locator, key = 'Enter'): Promise<void> {
  await target.focus();
  await target.press(key);
}

/** Checks a radio with Space, as the keyboard does within a group. */
async function chooseRadio(target: Locator): Promise<void> {
  await target.focus();
  await target.press('Space');
  await expect(target).toBeChecked();
}

/** Chooses an option of a combobox by typing its name, then Enter. */
async function chooseOption(page: Page, combobox: Locator, name: string): Promise<void> {
  await press(combobox, 'Enter');
  await page.keyboard.type(name);
  await press(page.getByRole('option', { name }).first(), 'Enter');
}

test(
  'the product from a first visit to the deletion of an account, without a mouse',
  { tag: '@acceptance' },
  async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    const admin = await adminPage(browser);
    const moderator = await adminPage(browser, MODERATOR_STATE);
    test.skip(!admin || !moderator, 'The staff of the run (admin:create, global-setup.ts).');

    // 3a. A holder established in Senegal creates her project; it waits in draft.
    const holder = await entrepreneur(browser, 'acceptance-holder', 'Mariama Faye', {
      profile: { headline: 'Fondatrice', countryCode: 'SN' },
    });
    const title = `Moulins solaires de Fatick ${Date.now()}`;
    const project = await apiProject(holder.page, title, {
      publish: false,
      goal: 1_000,
      tiers: [30, 1_000],
    });

    // 1. A visitor discovers the home page, the transparency and a project, by the keyboard.
    const visitorContext = await browser.newContext();
    const page = await visitorContext.newPage();
    await page.goto('/fr');
    await hydrated(page);
    await tabAndPress(
      page,
      page.getByRole('banner').getByRole('link', { name: 'Transparence et frais' }),
    );
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/fr\/transparency$/);
    await hydrated(page);
    await tabAndPress(page, page.getByRole('banner').getByRole('link', { name: 'Projets' }));
    await expect(page).toHaveURL(/\/fr\/projects$/);
    await hydrated(page);
    await tabAndPress(page, page.getByRole('main').locator('a[href^="/fr/projects/"]').first());
    await expect(page).toHaveURL(/\/fr\/projects\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // 2. They sign up, verify their address, accept the terms and pass the onboarding.
    const email = `acceptance-${Date.now()}@e2e.pitchorium.test`;
    await page.goto('/fr/sign-up');
    await hydrated(page);
    await tabAndType(page, page.getByLabel('Nom', { exact: true }), 'Léa Martin');
    await tabAndType(page, page.getByLabel('Adresse email'), email);
    await tabAndType(
      page,
      page.getByRole('textbox', { name: 'Mot de passe', exact: true }),
      PASSWORD,
    );
    await tabAndPress(page, page.getByRole('button', { name: 'Créer mon compte' }));
    await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse' })).toBeVisible();
    await page.goto(await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/verify-email[^\s"<>]*/));
    await expect(page.getByRole('heading', { name: 'Adresse vérifiée' })).toBeVisible();
    await hydrated(page);
    await tabAndPress(page, page.getByRole('link', { name: 'Continuer' }));
    await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible();
    await hydrated(page);
    for (const name of [
      /conditions d’utilisation/,
      /politique de confidentialité/,
      /au moins 18 ans/,
    ]) {
      await tabAndPress(page, page.getByRole('checkbox', { name }), 'Space');
    }
    await tabAndPress(page, page.getByRole('button', { name: 'Accepter et continuer' }));
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
    await hydrated(page);
    await chooseRadio(page.getByRole('radio', { name: /Je souhaite soutenir des projets/ }));
    await tabAndPress(page, page.getByRole('button', { name: 'Continuer' }));
    await expect(page.getByRole('heading', { name: 'Votre profil' })).toBeVisible();
    await hydrated(page);
    await tabAndType(page, page.getByLabel('Titre'), 'Ingénieure');
    await chooseOption(page, page.getByRole('combobox', { name: 'Pays' }), 'France');
    await tabAndPress(page, page.getByRole('button', { name: 'Entrer dans Pitchorium' }));
    await expect(page).toHaveURL(/\/fr\/feed/);

    // 3b. The team of the project publishes it, with the public display consent.
    const desk = holder.page;
    await desk.goto(`/fr/projects/${project.slug}/edit/publish`);
    await hydrated(desk);
    await press(
      desk.getByRole('checkbox', { name: /J’accepte l’affichage public de mon nom/ }),
      'Space',
    );
    await press(desk.getByRole('button', { name: 'Publier le projet' }));
    await desk.waitForURL(/\/fr\/projects\/[a-z0-9-]+\?published=1$/);
    await expect(desk.getByText('En financement').first()).toBeVisible();

    // 3c. She opens a payout account in a covered country and sends her identity check.
    await desk.goto('/fr/settings/payouts');
    await hydrated(desk);
    const choice = desk.getByTestId('payout-choice');
    await chooseOption(
      desk,
      choice.getByRole('combobox', { name: 'Pays de votre compte bancaire' }),
      'France',
    );
    await choice.getByLabel('Titulaire du compte').fill('Mariama Faye');
    await choice.getByLabel('Code de la banque').fill('30004');
    await choice.getByLabel('Numéro de compte').fill('FR76 3000 4000 0312 3456 7890 143');
    await press(
      choice.getByRole('checkbox', { name: /Je confirme remplir les conditions/ }),
      'Space',
    );
    await press(choice.getByRole('button', { name: 'Vérifier avant l’envoi' }));
    await press(choice.getByRole('button', { name: 'Ouvrir mon compte de versement' }));
    await expect(desk.getByTestId('payout-account')).toContainText('France');
    const kyc = desk.getByTestId('kyc-section');
    await kyc.locator('input[type="file"]').setInputFiles(await pngImage(desk, 800, 800));
    await press(kyc.getByRole('checkbox', { name: /Je certifie/ }), 'Space');
    const send = kyc.getByRole('button', { name: 'Envoyer pour vérification' });
    await expect(send).toBeEnabled({ timeout: 60_000 });
    await press(send);
    await expect(kyc).toContainText('Vos pièces sont en cours d’examen');

    // 3d. The administrator approves it in the console.
    const console_ = admin!.page;
    await console_.goto('/fr/admin/payments/kyc');
    await hydrated(console_);
    await press(console_.getByRole('link', { name: 'Mariama Faye' }).first());
    await hydrated(console_);
    await chooseRadio(console_.getByRole('radio', { name: /^Approuver/ }));
    await console_
      .getByRole('textbox', { name: 'Motif' })
      .fill('Pièce d’identité lisible et conforme.');
    await press(console_.getByRole('button', { name: 'Approuver' }));
    await expect(console_.locator('[data-announcer="polite"]')).toHaveText(
      'Vérification approuvée.',
    );

    // 4. The new member follows the project and contributes; the first tier unlocks.
    await page.goto(`/fr/projects/${project.slug}`);
    await hydrated(page);
    await tabAndPress(page, page.getByRole('button', { name: `Suivre ${title}` }).first());
    await expect(
      page.getByRole('button', { name: `Ne plus suivre ${title}` }).first(),
    ).toBeVisible();
    await tabAndPress(
      page,
      page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }),
    );
    const dialog = page.getByTestId('contribute-dialog');
    const next = async (step: string) => {
      if ((await dialog.getAttribute('data-step')) !== step) {
        await tabAndPress(page, dialog.getByRole('button', { name: 'Continuer' }));
      }
      await expect(dialog).toHaveAttribute('data-step', step);
    };
    await expect(dialog).toHaveAttribute('data-step', 'kind');
    await chooseRadio(dialog.getByRole('radio', { name: /^Don/ }));
    await next('country');
    await next('amount');
    await tabAndType(page, dialog.getByRole('textbox', { name: /Montant/ }), '40');
    await tabAndPress(page, dialog.getByRole('button', { name: 'Continuer' }));
    await expect(dialog).toHaveAttribute('data-step', /^(behalf|display)$/);
    if ((await dialog.getAttribute('data-step')) === 'behalf') await next('display');
    await next('method');
    await chooseRadio(dialog.getByRole('radio', { name: /Carte bancaire/ }));
    await next('review');
    await expect(dialog.getByText('Commission de Pitchorium (5 %)')).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/v1\/payments\/simulated\/checkout\//),
      tabAndPress(page, dialog.getByTestId('pay')),
    ]);
    await press(page.getByRole('button', { name: 'succeed', exact: true }));
    await press(page.getByRole('link', { name: 'Retour au site' }));
    await page.waitForURL(/\/contributions\/[\w-]+\/return$/);
    await expect(
      page.getByRole('heading', { name: 'Merci, votre contribution est confirmée' }),
    ).toBeVisible();
    await expect(page.getByText(/Palier 1 débloqué/)).toBeVisible();

    // 5. The holder reads the notification, sees the contribution and exports the CSV.
    // Arrived while the page is open, a notification waits behind the pill (ADR 0148): read again.
    await expect(async () => {
      await desk.goto('/fr/notifications');
      await expect(
        desk.getByRole('main').getByText(`Nouvelle contribution sur ${title}`),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await desk.goto(`/fr/projects/${project.slug}/manage?tab=contributions`);
    await hydrated(desk);
    await expect(desk.getByRole('table')).toContainText('Léa Martin');
    const [csv] = await Promise.all([
      desk.waitForEvent('download'),
      press(desk.getByRole('button', { name: 'Exporter en CSV' })),
    ]);
    expect(readFileSync(await csv.path(), 'utf8')).toContain('Léa Martin');

    // 6. They exchange messages in real time: the member writes, the holder answers.
    const own = (await (await ok(api(page, 'GET', '/v1/me/profile'))).json()) as { handle: string };
    const request = (await (
      await ok(api(desk, 'POST', '/v1/network/connection-requests', { handle: own.handle }))
    ).json()) as { id: string };
    await ok(api(page, 'POST', `/v1/network/connection-requests/${request.id}/accept`));
    const holderHandle = (
      (await (await ok(api(desk, 'GET', '/v1/me/profile'))).json()) as { handle: string }
    ).handle;
    await desk.goto('/fr/messages');
    await hydrated(desk);
    await page.goto(`/fr/messages/new?to=${holderHandle}`);
    await hydrated(page);
    await tabAndType(
      page,
      page.getByRole('textbox', { name: 'Votre message' }),
      'Bonjour Mariama, bravo pour les moulins.',
    );
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/fr\/messages\/[\w-]+$/);
    // Pushed to the holder without a reload.
    const conversation = desk.getByRole('link', { name: /Léa Martin/ });
    await expect(conversation).toContainText('bravo pour les moulins');
    await press(conversation);
    const reply = desk.getByRole('textbox', { name: 'Votre message' });
    await expect(reply).toBeVisible();
    await hydrated(desk);
    await reply.focus();
    await desk.keyboard.type('Merci Léa, je vous envoie des nouvelles du premier moulin.');
    await desk.keyboard.press('Enter');
    await expect(
      page.locator('[data-thread-scroller]').getByText('nouvelles du premier moulin'),
    ).toBeVisible();

    // 7. A publication of the holder is reported by the member, hidden by the administrator,
    // appealed by the holder and resolved by another moderator.
    const post = (await (
      await ok(
        api(desk, 'POST', '/v1/posts', {
          text: 'Offre exceptionnelle : écrivez-moi pour un rendement garanti.',
          visibility: 'members',
          commentsDisabled: false,
        }),
      )
    ).json()) as { id: string };
    await page.goto(`/fr/posts/${post.id}`);
    await hydrated(page);
    await tabAndPress(
      page,
      page.getByRole('article').first().getByRole('button', { name: 'Plus d’actions' }),
    );
    await press(page.getByRole('menuitem', { name: 'Signaler' }));
    const report = page.getByRole('dialog', { name: 'Signaler cette publication' });
    await chooseRadio(report.getByRole('radio', { name: 'Spam' }));
    await report.getByLabel(/Précisions/).fill('Une promesse de rendement garanti, sans source.');
    await press(report.getByRole('button', { name: 'Envoyer le signalement' }));
    await expect(page.getByRole('dialog', { name: 'Signalement reçu' })).toBeVisible();
    await page.keyboard.press('Escape');

    let caseId: string | undefined;
    await expect(async () => {
      const queue = (await (
        await ok(api(console_, 'GET', '/v1/admin/moderation/cases?targetType=post&limit=100'))
      ).json()) as { items: { id: string; targetId: string }[] };
      caseId = queue.items.find((item) => item.targetId === post.id)?.id;
      expect(caseId).toBeDefined();
    }).toPass({ timeout: 15_000 });
    await console_.goto(`/fr/admin/moderation/cases/${caseId}`);
    await hydrated(console_);
    await chooseRadio(console_.getByRole('radio', { name: /^Masquage/ }));
    await console_
      .getByLabel('Exposé des motifs')
      .fill('Une promesse de rendement sans source trompe les membres.');
    await console_
      .getByLabel(/Référence du fondement/)
      .fill('Conditions d’utilisation, publications');
    await press(console_.getByRole('button', { name: 'Décider' }));
    await press(console_.getByRole('alertdialog').getByRole('button', { name: /^Confirmer/ }));
    await expect(console_.locator('[data-announcer="polite"]')).toHaveText('Décision enregistrée.');

    await desk.goto('/fr/settings/moderation');
    await hydrated(desk);
    await expect(desk.getByText(/trompe les membres/)).toBeVisible();
    await press(desk.getByRole('button', { name: 'Faire appel' }));
    await desk
      .getByLabel('Vos arguments')
      .fill('Le rendement vient du rapport annuel de la coopérative.');
    await press(desk.getByRole('button', { name: 'Envoyer l’appel' }));
    await expect(desk.getByText(/Votre appel, envoyé le/)).toBeVisible();

    const other = moderator!.page;
    const appeal = other
      .getByRole('main')
      .getByRole('listitem')
      .filter({ hasText: 'trompe les membres' });
    await expect(async () => {
      await other.goto('/fr/admin/moderation/appeals');
      await expect(appeal).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await hydrated(other);
    await press(appeal.getByRole('button', { name: 'Trancher l’appel' }));
    const resolve = other.getByRole('dialog', { name: 'Trancher l’appel' });
    await chooseRadio(resolve.getByRole('radio', { name: /Maintenir la décision/ }));
    await resolve
      .getByLabel('Motivation')
      .fill('Aucune source jointe : la publication reste masquée.');
    await press(resolve.getByRole('button', { name: 'Enregistrer la décision finale' }));
    await expect(other.locator('[data-announcer="polite"]')).toHaveText('Appel tranché.');
    await desk.reload();
    await expect(desk.getByText(/Décision finale du/)).toBeVisible();

    // 8. The member exports their data, schedules the deletion of the account, then cancels it.
    await page.goto('/fr/settings/personal-data');
    await hydrated(page);
    await tabAndPress(page, page.getByRole('button', { name: 'Demander une archive' }));
    await expect(page.getByText(/Votre demande est enregistrée/)).toBeVisible();
    const download = page.getByRole('button', { name: 'Télécharger' });
    await expect(download).toBeVisible({ timeout: 60_000 });
    const [archive] = await Promise.all([page.waitForEvent('download'), press(download)]);
    expect(archive.suggestedFilename()).toMatch(/\.zip$/);
    await tabAndPress(page, page.getByRole('button', { name: 'Supprimer mon compte' }));
    const confirm = page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' });
    await confirm.getByRole('textbox').focus();
    await page.keyboard.type('supprimer mon compte');
    await press(confirm.getByRole('button', { name: 'Programmer la suppression' }));
    await expect(page.getByText(/Suppression programmée le/)).toBeVisible();
    await tabAndPress(page, page.getByRole('button', { name: 'Annuler la suppression' }));
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible();

    await Promise.all([
      visitorContext.close(),
      holder.context.close(),
      admin!.context.close(),
      moderator!.context.close(),
    ]);
  },
);
