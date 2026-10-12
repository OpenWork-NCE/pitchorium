import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { DATABASE_URL, endCampaign, endGracePeriod } from './database';
import {
  adminPage,
  allowConsole,
  api,
  apiProject,
  entrepreneur,
  expect,
  FAKE_OAUTH_URL,
  hydrated,
  LOCAL_TURNSTILE,
  memberPage,
  MODERATOR_STATE,
  ok,
  PASSWORD,
  test,
  WEB_URL,
} from './support';

/**
 * The reports, the moderation, the personal data and the translation against the real api
 * (PROMPT FRONT 8B): a publication reported from its menu, decided with its statement of reasons
 * by the administrator of the run, appealed by its author and resolved by another moderator
 * (through the api of the moderation tools, not delivered to the web); the notice without an
 * account through Turnstile; a message reported with its limited context; a suspended account
 * (the feed closed, the decision and the data open); the export to its download; the deletion blocked by a campaign, then scheduled,
 * cancelled, scheduled again and executed by the worker; the translation of a publication and of a
 * message at the reader's request only, and the daily limit (scripts/e2e-live.sh lowers it).
 */

type Member = Awaited<ReturnType<typeof memberPage>>;

/** A publication through the api, for the members or for everyone (a public page first). */
async function apiPost(
  member: Member,
  text: string,
  visibility: 'members' | 'public' = 'members',
): Promise<string> {
  if (visibility === 'public') {
    await ok(api(member.page, 'PATCH', '/v1/me/profile/visibility', { publicPageEnabled: true }));
  }
  const created = (await (
    await ok(api(member.page, 'POST', '/v1/posts', { text, visibility, commentsDisabled: false }))
  ).json()) as { id: string };
  return created.id;
}

async function userIdOf(page: Page): Promise<string> {
  return ((await (await ok(api(page, 'GET', '/v1/me'))).json()) as { user: { id: string } }).user
    .id;
}

/** The open case of the moderation about a target, as the moderators read it. */
async function caseOf(staff: Page, targetType: string, targetId: string): Promise<string> {
  let found: string | undefined;
  await expect(async () => {
    const page = (await (
      await ok(api(staff, 'GET', `/v1/admin/moderation/cases?targetType=${targetType}&limit=100`))
    ).json()) as { items: { id: string; targetId: string }[] };
    found = page.items.find((item) => item.targetId === targetId)?.id;
    expect(found).toBeDefined();
  }).toPass({ timeout: 15_000 });
  return found!;
}

/** The menu of a publication, then « Signaler » and its dialog filled with a reason. */
async function reportPost(page: Page, postId: string, reason: string): Promise<void> {
  await page.goto(`/fr/posts/${postId}`);
  await hydrated(page);
  await page.getByRole('article').first().getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('menuitem', { name: 'Signaler' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler cette publication' });
  await dialog.getByRole('radio', { name: reason }).check();
  await dialog.getByLabel(/Précisions/).fill('La même annonce, chaque jour, à des inconnus.');
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(page.getByRole('dialog', { name: 'Signalement reçu' })).toBeVisible();
}

test.describe('reports and moderation', () => {
  test(
    'a reported publication, decided with its reasons, then its appeal resolved by another moderator',
    { tag: '@critical' },
    async ({ browser }) => {
      const admin = await adminPage(browser);
      const moderator = await adminPage(browser, MODERATOR_STATE);
      test.skip(!admin || !moderator, 'The moderators of the run (demonstration data).');
      const author = await memberPage(browser, 'reported-author', { name: 'Ibrahima Sow' });
      const reporter = await memberPage(browser, 'reporter', { name: 'Mariama Kane' });
      const postId = await apiPost(author, 'Offre exceptionnelle : écrivez-moi pour un prix.');

      await reportPost(reporter.page, postId, 'Spam');
      await reporter.page.goto('/fr/settings/moderation');
      await hydrated(reporter.page);
      await expect(reporter.page.getByText(/Signalé le/)).toBeVisible();

      // The decision of the administrator of the run, with its statement of reasons.
      const caseId = await caseOf(admin!.page, 'post', postId);
      const decision = (await (
        await ok(
          api(admin!.page, 'POST', `/v1/admin/moderation/cases/${caseId}/decisions`, {
            kind: 'hide',
            reason: 'spam',
            statement:
              'La même offre commerciale a été publiée à des membres qui ne la demandaient pas.',
            ground: 'terms',
            groundReference: 'Conditions d’utilisation, publications',
          }),
        )
      ).json()) as { id: string };

      // The author reads the decision and its reasons, then appeals.
      await author.page.goto('/fr/settings/moderation');
      await hydrated(author.page);
      await expect(author.page.getByText(/membres qui ne la demandaient pas/)).toBeVisible();
      await expect(
        author.page.getByText(
          /^Conditions d.utilisation : Conditions d’utilisation, publications$/,
        ),
      ).toBeVisible();
      await author.page.getByRole('button', { name: 'Faire appel' }).click();
      await author.page
        .getByLabel('Vos arguments')
        .fill('Ces membres m’avaient demandé mes tarifs lors d’un salon à Dakar.');
      await author.page.getByRole('button', { name: 'Envoyer l’appel' }).click();
      await expect(author.page.getByText(/Votre appel, envoyé le/)).toBeVisible();

      // Another moderator than the author of the decision resolves the appeal.
      let appealId: string | undefined;
      await expect(async () => {
        const appeals = (await (
          await ok(api(moderator!.page, 'GET', '/v1/admin/moderation/appeals?limit=100'))
        ).json()) as { items: { id: string; appeal: { id: string } | null }[] };
        appealId = appeals.items.find((item) => item.id === decision.id)?.appeal?.id;
        expect(appealId).toBeDefined();
      }).toPass({ timeout: 15_000 });
      await ok(
        api(moderator!.page, 'POST', `/v1/admin/moderation/appeals/${appealId}/resolution`, {
          outcome: 'overturned',
          statement: 'Les destinataires avaient demandé ces tarifs : la publication est rétablie.',
        }),
      );

      await author.page.reload();
      await hydrated(author.page);
      await expect(author.page.getByText(/Décision finale du/)).toBeVisible();
      await expect(author.page.getByText(/la publication est rétablie/)).toBeVisible();
      const audit = await new AxeBuilder({ page: author.page }).include('main').analyze();
      expect(audit.violations).toEqual([]);
      await Promise.all([
        author.context.close(),
        reporter.context.close(),
        admin!.context.close(),
        moderator!.context.close(),
      ]);
    },
  );

  test('a notice of illegal content without an account, through Turnstile', async ({
    browser,
    page,
  }) => {
    const author = await memberPage(browser, 'notice-author');
    const postId = await apiPost(author, 'Une publication que quelqu’un juge illégale.', 'public');
    const verifications = async () =>
      (
        (await (await fetch(`${FAKE_OAUTH_URL}/turnstile/siteverify`)).json()) as {
          verifications: number;
        }
      ).verifications;
    const before = LOCAL_TURNSTILE ? await verifications() : 0;

    await page.goto('/fr/report');
    await hydrated(page);
    await page.getByLabel('Adresse du contenu').fill(`${WEB_URL}/fr/posts/${postId}`);
    await expect(page.getByText('Contenu signalé : Publication')).toBeVisible();
    await page
      .getByLabel('Explication')
      .fill('Ce contenu reproduit un document confidentiel volé.');
    await page.getByLabel(/Votre adresse email/).fill('lectrice@example.test');
    await page.getByRole('checkbox', { name: /Je déclare de bonne foi/ }).check();
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByText(/Votre signalement a été reçu le .*Sa référence : /)).toBeVisible();
    if (LOCAL_TURNSTILE) expect(await verifications()).toBeGreaterThan(before);
    await author.context.close();
  });

  test('a message reported with the few messages before it only', async ({ browser }) => {
    const a = await memberPage(browser, 'message-sender', { name: 'Ousmane Fall' });
    const b = await memberPage(browser, 'message-reader', { name: 'Awa Ndiaye' });
    const request = (await (
      await ok(api(a.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle }))
    ).json()) as { id: string };
    await ok(api(b.page, 'POST', `/v1/network/connection-requests/${request.id}/accept`));
    const message = (await (
      await ok(
        api(a.page, 'POST', '/v1/messaging/conversations', {
          recipientHandle: b.member.handle,
          clientMessageId: `live-${crypto.randomUUID()}`,
          body: 'Envoyez-moi votre code de vérification, c’est urgent.',
        }),
      )
    ).json()) as { conversationId: string };

    await b.page.goto(`/fr/messages/${message.conversationId}`);
    await expect(b.page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
    await hydrated(b.page);
    const bubble = b.page
      .locator('[data-message-sequence]')
      .filter({ hasText: 'code de vérification' });
    await bubble.hover();
    await bubble.getByRole('button', { name: 'Actions du message' }).click();
    await b.page.getByRole('menuitem', { name: 'Signaler' }).click();
    const dialog = b.page.getByRole('dialog', { name: 'Signaler ce message' });
    await expect(dialog.getByText(/les trois messages qui le précèdent/)).toBeVisible();
    await dialog.getByRole('radio', { name: 'Fraude ou arnaque' }).check();
    await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(b.page.getByRole('dialog', { name: 'Signalement reçu' })).toBeVisible();
    await Promise.all([a.context.close(), b.context.close()]);
  });

  test('a suspended account finds the feed closed, appeals and keeps its data', async ({
    browser,
  }) => {
    const admin = await adminPage(browser);
    test.skip(!admin, 'The administrator of the run (admin:create).');
    const suspended = await memberPage(browser, 'suspended', { name: 'Cheikh Diallo' });
    const reporter = await memberPage(browser, 'suspension-reporter');
    await ok(
      api(reporter.page, 'POST', '/v1/reports', {
        targetType: 'profile',
        targetId: suspended.member.handle,
        reason: 'fraud',
        details: 'Demande des paiements par transfert direct.',
      }),
    );
    const caseId = await caseOf(admin!.page, 'profile', await userIdOf(suspended.page));
    await ok(
      api(admin!.page, 'POST', `/v1/admin/moderation/cases/${caseId}/decisions`, {
        kind: 'suspend',
        reason: 'fraud',
        statement: 'Plusieurs membres rapportent des demandes de paiement hors de la plateforme.',
        ground: 'terms',
        suspensionDays: 7,
      }),
    );

    // The suspension revokes the sessions of the member, who signs in again to read.
    const { page } = suspended;
    await ok(
      api(page, 'POST', '/v1/auth/sign-in/email', {
        email: suspended.member.email,
        password: PASSWORD,
      }),
    );
    await page.goto('/fr/feed');
    await hydrated(page);
    // The api refuses the feed to a suspended account: the page says so, without asking it.
    await expect(page.getByRole('heading', { name: 'Votre compte est suspendu' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Commencer une publication/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publier', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Voir la décision' }).first().click();
    await expect(page).toHaveURL(/\/fr\/settings\/moderation$/);
    await expect(page.getByText('Votre compte est suspendu', { exact: true })).toBeVisible();
    await expect(page.getByText(/demandes de paiement hors de la plateforme/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Faire appel' })).toBeVisible();
    await page.goto('/fr/settings/personal-data');
    await hydrated(page);
    await expect(page.getByRole('button', { name: 'Demander une archive' })).toBeEnabled();
    await Promise.all([
      suspended.context.close(),
      reporter.context.close(),
      admin!.context.close(),
    ]);
  });
});

test.describe('personal data', () => {
  test(
    'an archive asked, built by the worker, then downloaded',
    { tag: '@critical' },
    async ({ browser }) => {
      const { page, context } = await memberPage(browser, 'export');
      await page.goto('/fr/settings/personal-data');
      await hydrated(page);
      await expect(page.getByText('Vous n’avez pas encore demandé d’archive.')).toBeVisible();
      await page.getByRole('button', { name: 'Demander une archive' }).click();
      await expect(page.getByText(/Votre demande est enregistrée/)).toBeVisible();
      // The worker builds the archive, the api says so by a notification: the page reads again.
      const download = page.getByRole('button', { name: 'Télécharger' });
      await expect(download).toBeVisible({ timeout: 60_000 });
      await expect(
        page
          .getByRole('paragraph')
          .filter({ hasText: /Une nouvelle archive pourra être demandée/ }),
      ).toBeVisible();
      const file = page.waitForEvent('download');
      await download.click();
      const archive = await file;
      expect(archive.suggestedFilename()).toMatch(/\.zip$/);
      const { statSync } = await import('node:fs');
      expect(statSync(await archive.path()).size).toBeGreaterThan(0);
      const audit = await new AxeBuilder({ page }).include('main').analyze();
      expect(audit.violations).toEqual([]);
      await context.close();
    },
  );

  test('a deletion blocked by a campaign, then scheduled, cancelled, scheduled again and executed', async ({
    browser,
  }) => {
    test.skip(!DATABASE_URL, 'The end of a campaign and of a grace period (LIVE_DATABASE_URL).');
    test.setTimeout(180_000);
    const holder = await entrepreneur(browser, 'erasure', 'Salimata Coulibaly');
    const { page, member } = holder;
    const project = await apiProject(page, `Moulin de Kaolack ${Date.now()}`);

    await page.goto('/fr/settings/personal-data');
    await hydrated(page);
    await expect(
      page.getByText('Votre compte ne peut pas être supprimé pour l’instant'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voir la campagne' })).toHaveAttribute(
      'href',
      `/fr/projects/${project.slug}`,
    );
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toHaveCount(0);

    // The campaign ends; the worker closes it.
    expect(await endCampaign(project.id)).toBe(1);
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 60_000 });
    await hydrated(page);

    const schedule = async () => {
      await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' });
      await confirm.getByRole('textbox').fill('supprimer mon compte');
      await confirm.getByRole('button', { name: 'Programmer la suppression' }).click();
      await expect(page.getByText(/Suppression programmée le/)).toBeVisible();
    };
    await schedule();
    await expect(page.getByText(/Un rappel vous sera envoyé le/)).toBeVisible();
    await page.getByRole('button', { name: 'Annuler la suppression' }).click();
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible();
    await schedule();

    // The grace period is over: the worker erases, the page signs out on this device.
    // The api no longer knows the session once the account is erased, on purpose.
    allowConsole(/status of 401 \(Unauthorized\)/);
    expect(await endGracePeriod(await userIdOf(page))).toBe(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Votre compte a été supprimé' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page).toHaveURL(/\/fr\/account-deleted$/);
    const signIn = await api(page, 'POST', '/v1/auth/sign-in/email', {
      email: member.email,
      password: PASSWORD,
    });
    expect(signIn.status()).toBeGreaterThanOrEqual(400);
    await holder.context.close();
  });
});

test.describe('translation on demand', () => {
  const ENGLISH =
    'We are looking for a finance mentor to help our cooperative prepare its first bank loan.';

  test('a publication in another language translated in place, then its original', async ({
    browser,
  }) => {
    const author = await memberPage(browser, 'english-author', { name: 'Grace Mensah' });
    const reader = await memberPage(browser, 'french-reader');
    const postId = await apiPost(author, ENGLISH);
    const { page } = reader;
    await page.goto(`/fr/posts/${postId}`);
    await hydrated(page);
    const post = page.getByRole('article').first();
    await expect(post.getByText(ENGLISH)).toBeVisible();
    await post.getByRole('button', { name: 'Traduire' }).click();
    await expect(post.getByText(`[fr] ${ENGLISH}`)).toBeVisible();
    await expect(post.getByText('Traduction automatique (traduction simulée).')).toBeVisible();
    await post.getByRole('button', { name: 'Voir l’original' }).click();
    await expect(post.getByText(ENGLISH, { exact: true })).toBeVisible();
    // A publication in the language of the page offers nothing.
    const french = await apiPost(author, 'Nous cherchons une mentore finance pour la coopérative.');
    await page.goto(`/fr/posts/${french}`);
    await hydrated(page);
    await expect(page.getByRole('button', { name: 'Traduire' })).toHaveCount(0);
    await Promise.all([author.context.close(), reader.context.close()]);
  });

  test('a message is translated at the request of its reader only', async ({ browser }) => {
    const a = await memberPage(browser, 'english-sender', { name: 'Grace Mensah' });
    const b = await memberPage(browser, 'french-recipient');
    const request = (await (
      await ok(api(a.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle }))
    ).json()) as { id: string };
    await ok(api(b.page, 'POST', `/v1/network/connection-requests/${request.id}/accept`));
    const message = (await (
      await ok(
        api(a.page, 'POST', '/v1/messaging/conversations', {
          recipientHandle: b.member.handle,
          clientMessageId: `live-${crypto.randomUUID()}`,
          body: ENGLISH,
        }),
      )
    ).json()) as { conversationId: string };

    const { page } = b;
    await page.goto(`/fr/messages/${message.conversationId}`);
    await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
    await hydrated(page);
    const bubble = page.locator('[data-message-sequence]').filter({ hasText: ENGLISH });
    // Nothing is translated without the reader's request.
    await expect(bubble.getByText(ENGLISH, { exact: true })).toBeVisible();
    await expect(page.getByText(/Traduction automatique/)).toHaveCount(0);
    await bubble.hover();
    await bubble.getByRole('button', { name: 'Actions du message' }).click();
    await page.getByRole('menuitem', { name: 'Traduire' }).click();
    await expect(bubble.getByText(`[fr] ${ENGLISH}`)).toBeVisible();
    await expect(bubble.getByText('Traduction automatique (traduction simulée).')).toBeVisible();
    await Promise.all([a.context.close(), b.context.close()]);
  });

  test('says when the daily limit of translations is reached', async ({ browser }) => {
    // Beyond the daily limit of the run (scripts/e2e-live.sh), the api refuses on purpose.
    allowConsole(/status of 429 \(Too Many Requests\) \(\S+\/v1\/translations/);
    const author = await memberPage(browser, 'long-author', { name: 'Grace Mensah' });
    const reader = await memberPage(browser, 'capped-reader');
    const postId = await apiPost(author, `${ENGLISH} `.repeat(20).trim());
    const { page } = reader;
    await page.goto(`/fr/posts/${postId}`);
    await hydrated(page);
    const post = page.getByRole('article').first();
    await post.getByRole('button', { name: 'Traduire' }).click();
    await expect(post.getByText(/Vous avez atteint votre limite de traductions/)).toBeVisible();
    await Promise.all([author.context.close(), reader.context.close()]);
  });
});
