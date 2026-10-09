import { type Page } from '@playwright/test';
import {
  acceptTerms,
  allowConsole,
  choose,
  expect,
  freshEmail,
  hydrated,
  linkFromInbox,
  memberPage,
  pngImage,
  signUpAndVerify,
  test,
} from './support';

const INVITATION_LINK = /http[^\s"<>]*\/invitations\/[A-Za-z0-9_-]{43}/;

/** The link of the email leads to the language of the reader: the journeys read it in French. */
const inFrench = (link: string) => link.replace('/invitations/', '/fr/invitations/');

/** Creates an organisation through the guided creation; resolves on its management. */
async function createOrganization(page: Page, name: string): Promise<void> {
  await page.goto('/fr/organizations/new');
  await hydrated(page);
  await page.getByLabel('Nom de l’organisation').fill(name);
  await choose(page, 'Type de structure', 'Fondation');
  await choose(page, 'Pays d’activité', 'Sénégal', 'Sénégal');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page
    .getByLabel('Présentation')
    .fill('Bourses et mentorat pour les entrepreneures du Sahel.');
  await page.getByRole('button', { name: 'Créer l’organisation' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Gérer ${name}` })).toBeVisible();
  await expect(page.getByText('Organisation créée')).toBeVisible();
}

/** Organisations against the real api (§10.7). */
test.describe('organisations', () => {
  test(
    'a member creates an organisation, edits it and finds it in their organisations',
    { tag: '@critical' },
    async ({ browser }) => {
      const { page, context } = await memberPage(browser, 'org-create', { name: 'Nadia Benali' });
      const name = `Fondation Sahel ${Date.now()}`;
      await createOrganization(page, name);

      await page.getByLabel('Site web').fill('https://example.org');
      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' && response.url().includes('/v1/organizations/'),
      );
      await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
      expect((await saved).ok()).toBe(true);

      await page.getByRole('link', { name: `Retour à la page de ${name}` }).click();
      await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
      await expect(
        page.getByText('Bourses et mentorat pour les entrepreneures du Sahel.'),
      ).toBeVisible();
      await expect(page.getByText('Propriétaire').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Site web/ })).toBeVisible();

      await hydrated(page);
      await page.getByRole('button', { name: /Compte de/ }).click();
      await page.getByRole('menuitem', { name: 'Mes organisations' }).click();
      await expect(
        page.getByRole('list', { name: 'Mes organisations' }).getByText(name),
      ).toBeVisible();
      await context.close();
    },
  );

  test(
    'an invited member accepts, gets a role, then the ownership',
    { tag: '@critical' },
    async ({ browser }) => {
      const owner = await memberPage(browser, 'org-owner', { name: 'Thierry Lacroix' });
      const invitee = await memberPage(browser, 'org-invitee', { name: 'Fatou Sow' });
      const name = `Diaspora Invest ${Date.now()}`;
      await createOrganization(owner.page, name);
      await expect(owner.page.getByText(/Vous êtes le seul propriétaire/)).toHaveCount(0);

      await owner.page.getByRole('tab', { name: 'Membres' }).click();
      await expect(owner.page.getByText(/Vous êtes le seul propriétaire/)).toBeVisible();
      await owner.page.getByLabel('Adresse email').fill(invitee.member.email);
      await owner.page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
      await expect(
        owner.page
          .getByRole('list', { name: 'Invitations en attente' })
          .getByText(invitee.member.email),
      ).toBeVisible();

      await invitee.page.goto(inFrench(await linkFromInbox(invitee.member.email, INVITATION_LINK)));
      await hydrated(invitee.page);
      await expect(invitee.page.getByRole('heading', { name: `Rejoindre ${name}` })).toBeVisible();
      await invitee.page.getByRole('button', { name: 'Accepter' }).click();
      // Exact: the heading of the invitation page (« Rejoindre <name> ») holds the name too.
      await expect(
        invitee.page.getByRole('heading', { level: 1, name, exact: true }),
      ).toBeVisible();

      await owner.page.reload();
      await hydrated(owner.page);
      const row = owner.page.locator(`[data-member="${invitee.member.handle}"]`);
      await choose(row, 'Rôle de Fatou Sow', 'Administrateur');
      await expect(row.getByRole('combobox', { name: 'Rôle de Fatou Sow' })).toHaveText(
        /Administrateur/,
      );

      await choose(owner.page, 'Nouveau propriétaire', 'Fatou Sow');
      await owner.page.getByRole('button', { name: 'Transférer' }).click();
      await owner.page.getByRole('alertdialog').getByRole('button', { name: 'Transférer' }).click();
      // The former owner stays admin: the new owner is no longer theirs to manage.
      await expect(row.getByText('Propriétaire')).toBeVisible();
      await owner.context.close();
      await invitee.context.close();
    },
  );

  test('a person without an account signs up, then accepts the invitation', async ({ browser }) => {
    const owner = await memberPage(browser, 'org-external', { name: 'Claudine Pierre-Louis' });
    const name = `Kréyol Impact ${Date.now()}`;
    await createOrganization(owner.page, name);
    await owner.page.getByRole('tab', { name: 'Membres' }).click();
    const email = freshEmail('org-newcomer');
    await owner.page.getByLabel('Adresse email').fill(email);
    await owner.page.getByRole('button', { name: 'Envoyer l’invitation' }).click();
    await expect(
      owner.page.getByRole('list', { name: 'Invitations en attente' }).getByText(email),
    ).toBeVisible();

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    const link = inFrench(await linkFromInbox(email, INVITATION_LINK));
    await page.goto(link);
    await expect(page.getByRole('heading', { name: `Rejoindre ${name}` })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Créer un compte' })).toBeVisible();

    await signUpAndVerify(page, email, 'Rose Désir');
    await page.getByRole('link', { name: 'Continuer' }).click();
    await acceptTerms(page);
    // The terms lead to the onboarding: the invitation is opened once it is there.
    await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
    await page.goto(link);
    await hydrated(page);
    await page.getByRole('button', { name: 'Accepter' }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    await visitor.close();
    await owner.context.close();
  });

  test('the owner requests the verification with a document, then deletes the page', async ({
    browser,
  }) => {
    // The deleted page is opened again on purpose.
    allowConsole(/status of 404 \(Not Found\)/);
    test.setTimeout(180_000);
    const { page, context } = await memberPage(browser, 'org-verify', { name: 'Aïssatou Ba' });
    const name = `Femmes du Sahel ${Date.now()}`;
    await createOrganization(page, name);
    await page.getByRole('tab', { name: 'Vérification' }).click();
    await page.locator('input[type="file"]').setInputFiles(await pngImage(page, 800, 800));
    await expect(page.getByRole('button', { name: 'Envoyer la demande' })).not.toHaveAttribute(
      'aria-describedby',
      /.+/,
      { timeout: 120_000 },
    );
    await page
      .getByRole('textbox', { name: 'Déclaration' })
      .fill('Association de 600 entrepreneures ; je la coordonne.');
    await page.getByRole('checkbox', { name: /Je certifie/ }).check();
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(page.getByText('En cours d’examen', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Page' }).click();
    await page.getByRole('button', { name: 'Supprimer l’organisation' }).click();
    const confirm = page.getByRole('alertdialog');
    await confirm.getByRole('textbox').fill(name);
    await confirm.getByRole('button', { name: 'Supprimer l’organisation' }).click();
    await expect(page).toHaveURL(/\/fr\/settings\/organizations$/);
    expect(
      (await page.goto(`/fr/organizations/${name.toLowerCase().replaceAll(' ', '-')}`))?.status(),
    ).toBe(404);
    await context.close();
  });
});
