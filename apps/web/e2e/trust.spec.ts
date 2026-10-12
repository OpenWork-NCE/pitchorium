import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { allowConsole, API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

/**
 * The reports, the moderation, the personal data and the translation (PROMPT FRONT 8B) against the
 * stub api (e2e/support/stub-trust.mjs): a publication reported from its menu, the notice of
 * illegal content without an account, the decisions of a suspended member and their appeal, the
 * member space of a suspended account (the feed closed), the export and its download, the deletion of the
 * account with its blocker, its phrase, a sign-in that is too old and its grace period, the
 * translation in place and the way back to the original, and axe in both themes.
 */
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const SUSPENDED = 'moussa.diop@demo.pitchorium.test';
const FREE = 'claudine.pierre.louis@demo.pitchorium.test';
const SCHEDULED = 'koffi.agbodjan@demo.pitchorium.test';
const ENGLISH_POST = '0192f4a0-2000-7000-8000-000000000002';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

/** A cookie the stub reads to answer as the api would in a given state. */
async function stubState(context: BrowserContext, name: string): Promise<void> {
  await context.addCookies([{ name, value: '1', url: API_ORIGIN }]);
}

function englishPost(page: Page) {
  return page.getByRole('article').filter({ hasText: 'Short and clear' });
}

test.describe('reports and moderation', () => {
  test('reports a publication from its menu, with the reasons of the api', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/feed');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await englishPost(page).getByRole('button', { name: 'Plus d’actions' }).click();
    await page.getByRole('menuitem', { name: 'Signaler' }).click();
    const dialog = page.getByRole('dialog', { name: 'Signaler cette publication' });
    await dialog.getByRole('radio', { name: 'Spam' }).check();
    await dialog.getByLabel(/Précisions/).fill('La même annonce, chaque jour.');
    await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByRole('dialog', { name: 'Signalement reçu' })).toBeVisible();
    const writes = await stub(request).writes();
    expect(writes.filter((write) => write.route === 'report')).toHaveLength(1);
  });

  test('notifies illegal content without an account, by the address of its page', async ({
    page,
    request,
  }) => {
    await page.goto('/fr/report');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await page
      .getByLabel('Adresse du contenu')
      .fill(`http://localhost:3201/fr/posts/${ENGLISH_POST}`);
    await expect(page.getByText('Contenu signalé : Publication')).toBeVisible();
    await page
      .getByLabel('Explication')
      .fill('Ce contenu reproduit un document confidentiel volé.');
    await page.getByRole('checkbox', { name: /Je déclare de bonne foi/ }).check();
    await page.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(page.getByText('Signalement reçu')).toBeVisible();
    await expect(page.getByText(/Sans adresse email, vous ne serez pas informé/)).toBeVisible();
    const writes = await stub(request).writes();
    expect(writes.some((write) => write.route === 'notice')).toBe(true);
  });

  test('a suspended member reads the reasons of the decisions and appeals one', async ({
    page,
  }) => {
    await signIn(page, SUSPENDED);
    await page.goto('/fr/feed');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Voir la décision' }).first().click();
    await expect(page).toHaveURL(/\/fr\/settings\/moderation$/);
    await expect(page.getByText('Votre compte est suspendu', { exact: true })).toBeVisible();
    await expect(page.getByText(/transfert direct, hors de la plateforme/)).toBeVisible();
    // An appeal decided by another moderator: the final decision and its reasons.
    await expect(page.getByText(/l’avertissement est maintenu/)).toBeVisible();
    await page.getByRole('button', { name: 'Faire appel' }).click();
    await page
      .getByLabel('Vos arguments')
      .fill('Ces paiements étaient des remboursements entre associés.');
    await page.getByRole('button', { name: 'Envoyer l’appel' }).click();
    await expect(page.getByText(/Votre appel, envoyé le/).first()).toBeVisible();
  });

  test('a suspended member finds the feed closed, and keeps the decision and their data', async ({
    page,
  }) => {
    await signIn(page, SUSPENDED);
    await page.goto('/fr/feed');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText(/^Votre compte est suspendu\. Consultez la décision/),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Votre compte est suspendu' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Commencer une publication/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publier', exact: true })).toBeDisabled();
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Exporter vos données' })).toBeVisible();
  });
});

test.describe('personal data', () => {
  test('downloads a ready archive, and says when the next one may be asked', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('paragraph').filter({ hasText: /Une nouvelle archive pourra être demandée/ }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Demander une archive' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Télécharger' }).click();
    expect((await download).suggestedFilename()).toBe('pitchorium-export.zip');
  });

  test('a campaign in progress blocks the deletion, with the way to it', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByText('Votre compte ne peut pas être supprimé pour l’instant'),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Voir la campagne' })).toHaveAttribute(
      'href',
      '/fr/projects/ferme-solaire-thies',
    );
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toHaveCount(0);
  });

  test('schedules the deletion after a typed phrase, then cancels it', async ({ page }) => {
    await signIn(page, FREE);
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' });
    const schedule = confirm.getByRole('button', { name: 'Programmer la suppression' });
    await expect(schedule).toHaveAttribute('aria-disabled', 'true');
    await confirm.getByRole('textbox').fill('supprimer mon compte');
    await schedule.click();
    await expect(page.getByText(/Suppression programmée le/)).toBeVisible();
    await expect(page.getByText(/Un rappel vous sera envoyé le/)).toBeVisible();
    await page.getByRole('button', { name: 'Annuler la suppression' }).click();
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible();
  });

  test('asks a recent sign-in before scheduling, and comes back to the confirmation', async ({
    page,
    context,
  }) => {
    // The api refuses a sign-in that is too old, on purpose.
    allowConsole(/status of 403 \(Forbidden\) \(\S+\/v1\/me\/privacy\/erasure/);
    await signIn(page, FREE);
    await stubState(context, 'stub-stale');
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' });
    await confirm.getByRole('textbox').fill('supprimer mon compte');
    await confirm.getByRole('button', { name: 'Programmer la suppression' }).click();
    await expect(page.getByText('Reconnectez-vous pour confirmer')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Se reconnecter' })).toHaveAttribute(
      'href',
      /sign-in\?redirectTo=.*personal-data%3Ferase%3D1/,
    );
    await page.goto('/fr/settings/personal-data?erase=1');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' })).toBeVisible();
  });

  test('a deletion in its grace period is cancelled', async ({ page }) => {
    await signIn(page, SCHEDULED);
    await page.goto('/fr/settings/personal-data');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Suppression programmée le/)).toBeVisible();
    await page.getByRole('button', { name: 'Annuler la suppression' }).click();
    await expect(page.getByRole('button', { name: 'Supprimer mon compte' })).toBeVisible();
  });
});

test.describe('translation on demand', () => {
  test('translates a publication in another language in place, then shows the original', async ({
    page,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/feed');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    const post = englishPost(page);
    await post.getByRole('button', { name: 'Traduire' }).click();
    await expect(
      post.getByText('Court et clair : nous recrutons une mentore finance.'),
    ).toBeVisible();
    await expect(post.getByText('Traduction automatique (DeepL).')).toBeVisible();
    await post.getByRole('button', { name: 'Voir l’original' }).click();
    await expect(post.getByText('Short and clear: we are hiring a finance mentor.')).toBeVisible();
    // A publication in the language of the page offers nothing.
    await expect(page.getByRole('button', { name: 'Traduire' })).toHaveCount(0);
  });

  test('says when the limit of translations is reached', async ({ page, context }) => {
    // The api refuses beyond the limit, on purpose.
    allowConsole(/status of 429 \(Too Many Requests\) \(\S+\/v1\/translations/);
    await signIn(page, MEMBER);
    await stubState(context, 'stub-translation-cap');
    await page.goto('/fr/feed');
    // The page answers once hydrated.
    await page.waitForLoadState('networkidle');
    const post = englishPost(page);
    await post.getByRole('button', { name: 'Traduire' }).click();
    await expect(post.getByText(/Vous avez atteint votre limite de traductions/)).toBeVisible();
  });
});

test.describe('accessibility of the trust screens', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`axe on the reports, the moderation and the personal data (${colorScheme})`, async ({
      browser,
    }) => {
      for (const [email, path] of [
        [null, '/fr/report'],
        [SUSPENDED, '/fr/settings/moderation'],
        [MEMBER, '/fr/settings/personal-data'],
        [SCHEDULED, '/fr/settings/personal-data'],
      ] as const) {
        const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
        const page = await context.newPage();
        if (email) await signIn(page, email);
        await page.goto(path);
        // The page answers once hydrated.
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        const audit = await new AxeBuilder({ page }).include('main').analyze();
        expect(audit.violations, path).toEqual([]);
        await context.close();
      }
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signIn(page, MEMBER);
      await page.goto('/fr/feed');
      // The page answers once hydrated.
      await page.waitForLoadState('networkidle');
      await englishPost(page).getByRole('button', { name: 'Plus d’actions' }).click();
      await page.getByRole('menuitem', { name: 'Signaler' }).click();
      const dialog = page.getByRole('dialog', { name: 'Signaler cette publication' });
      await expect(dialog.getByRole('radio', { name: 'Spam' })).toBeVisible();
      const audit = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(audit.violations, 'report dialog').toEqual([]);
      await context.close();
    });
  }
});
