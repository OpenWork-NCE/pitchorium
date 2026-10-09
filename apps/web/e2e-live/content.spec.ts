import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import {
  allowConsole,
  api,
  expect,
  hydrated,
  memberPage,
  ok,
  signInWithPassword,
  test,
} from './support';

/**
 * The feed and its publications against the real api (§10.3, PROMPT FRONT 4): the composer with
 * a mention, images, a document and a link, the audiences, reposts, reactions, comments, saves,
 * the pill of new publications, the public page of a publication, the statistics, the draft
 * kept on the device and the return to the same place of the feed.
 */

/** A name nobody else of the run carries: the searches of mentions find this member only. */
function uniqueName(first: string): string {
  const letters = Array.from({ length: 7 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26)),
  ).join('');
  return `${first} ${letters[0]!.toUpperCase()}${letters.slice(1)}`;
}

async function openComposer(page: Page): Promise<Locator> {
  await page.goto('/fr/feed');
  await hydrated(page);
  await page.getByRole('button', { name: 'Commencer une publication' }).click();
  const dialog = page.getByRole('dialog', { name: 'Créer une publication' });
  await expect(dialog.getByRole('textbox', { name: 'Texte de la publication' })).toBeVisible();
  return dialog;
}

/** Publishes once the files are sent and checked (the composer asks to wait until then). */
async function publish(dialog: Locator): Promise<void> {
  await expect(async () => {
    if (await dialog.isHidden()) return;
    await dialog.getByRole('button', { name: 'Publier', exact: true }).click({ timeout: 2_000 });
    await expect(dialog).toBeHidden({ timeout: 2_000 });
  }).toPass({ timeout: 90_000 });
}

/** The publication of the page whose text contains this sentence. */
function postWith(page: Page, text: string): Locator {
  return page.getByRole('article').filter({ hasText: text }).first();
}

/** Publishes through the api, for the journeys about what comes after. */
async function apiPost(
  page: Page,
  text: string,
  visibility: 'public' | 'members' | 'connections' = 'members',
): Promise<string> {
  const created = (await (
    await ok(api(page, 'POST', '/v1/posts', { text, visibility, commentsDisabled: false }))
  ).json()) as { id: string };
  return created.id;
}

/** A photo of random pixels: heavy and large enough to be made lighter before it is sent. */
async function heavyPhoto(page: Page, index: number) {
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2600;
    canvas.height = 1700;
    const context = canvas.getContext('2d')!;
    const image = context.createImageData(canvas.width, canvas.height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      image.data[offset] = Math.random() * 255;
      image.data[offset + 1] = Math.random() * 255;
      image.data[offset + 2] = Math.random() * 255;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!;
  });
  return {
    name: `photo-${index}.jpg`,
    mimeType: 'image/jpeg',
    buffer: Buffer.from(data, 'base64'),
  };
}

/** A valid PDF of two pages, with a correct cross-reference table. */
function twoPagePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>',
    '<< /Length 27 >>\nstream\n0 0 1 rg 50 50 200 200 re f\nendstream',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R /Resources << >> >>',
    '<< /Length 27 >>\nstream\n1 0 0 rg 50 50 200 200 re f\nendstream',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return {
    name: 'Rapport de test.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(body, 'latin1'),
  };
}

async function choose(page: Page, button: Locator, files: Parameters<Page['setInputFiles']>[1]) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles(files);
}

test.describe('publications', { tag: '@critical' }, () => {
  test('a publication mentions a member, who is notified', async ({ browser }) => {
    const mentionedName = uniqueName('Bintou');
    const b = await memberPage(browser, 'post-mentioned', { name: mentionedName });
    const a = await memberPage(browser, 'post-author', { name: uniqueName('Awa') });

    const dialog = await openComposer(a.page);
    const editor = dialog.getByRole('textbox', { name: 'Texte de la publication' });
    await editor.pressSequentially('Merci ');
    // The search of the api indexes a new member within seconds: typed again until found.
    const surname = mentionedName.split(' ')[1]!;
    await expect(async () => {
      await editor.pressSequentially(`@${surname.slice(0, 5)}`);
      try {
        await expect(dialog.getByRole('option', { name: new RegExp(surname) })).toBeVisible({
          timeout: 3_000,
        });
      } catch (error) {
        for (let typed = 0; typed < 6; typed += 1) await editor.press('Backspace');
        throw error;
      }
    }).toPass({ timeout: 30_000 });
    await editor.press('Enter');
    await editor.pressSequentially('pour la visite de la coopérative.');
    await expect(dialog.getByText(/\/ 3\D?000$/)).toBeVisible();
    await publish(dialog);

    const post = postWith(a.page, 'pour la visite de la coopérative.');
    await expect(post.getByRole('link', { name: mentionedName })).toBeVisible();

    // Written by the worker from the event of the publication.
    // (the page of the notifications comes later: the counter of the header says it).
    await expect(async () => {
      await b.page.goto('/fr/feed');
      await expect(
        b.page.getByRole('link', { name: /^Notifications\s?, 1 notification non lue$/ }),
      ).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await a.context.close();
    await b.context.close();
  });

  test('five photos are made lighter, described and read in the viewer by keyboard', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'post-images');
    const dialog = await openComposer(a.page);
    const photos = await Promise.all([1, 2, 3, 4, 5].map((index) => heavyPhoto(a.page, index)));
    const sent: number[] = [];
    a.page.on('request', (request) => {
      if (request.method() === 'PUT' && /quarantine/.test(request.url())) {
        sent.push(request.postDataBuffer()?.length ?? 0);
      }
    });
    await choose(a.page, dialog.getByRole('button', { name: 'Ajouter des images' }), photos);
    // Every photo made lighter, sent and checked by the api before publishing.
    await expect(
      dialog.getByRole('list', { name: 'Images de la publication' }).getByRole('listitem'),
    ).toHaveCount(5);
    await expect(dialog.getByText(/Allègement|Envoi :|Vérification|n’a pas abouti/)).toHaveCount(
      0,
      { timeout: 90_000 },
    );
    await dialog
      .getByRole('textbox', { name: 'Texte alternatif de l’image 1' })
      .fill('Un dégradé de points de couleur.');
    await dialog.getByRole('textbox', { name: 'Texte de la publication' }).fill('Cinq photos.');
    await publish(dialog);
    // Every photo left lighter than it was chosen.
    expect(sent).toHaveLength(5);
    for (const [index, size] of sent.entries()) {
      expect(size).toBeLessThan(photos[index]!.buffer.length);
    }

    const post = postWith(a.page, 'Cinq photos.');
    const first = post.getByRole('button', { name: 'Agrandir l’image 1 sur 5' });
    // The children of a button are presentational (Firefox exposes no image): by its text.
    await expect(first.locator('img[alt="Un dégradé de points de couleur."]')).toBeVisible();
    await first.click();
    const viewer = a.page.getByRole('dialog', { name: /^Images de la publication/ });
    await expect(viewer.getByText('1 / 5')).toBeVisible();
    await a.page.keyboard.press('ArrowRight');
    await expect(viewer.getByText('2 / 5')).toBeVisible();
    await a.page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(first).toBeFocused();
    await a.context.close();
  });

  test('a PDF document is published with its title and pages', async ({ browser }) => {
    const a = await memberPage(browser, 'post-document');
    const dialog = await openComposer(a.page);
    await choose(a.page, dialog.getByRole('button', { name: 'Ajouter un PDF' }), twoPagePdf());
    await expect(dialog.getByRole('textbox', { name: 'Titre du document' })).toHaveValue(
      'Rapport de test',
    );
    await dialog.getByRole('textbox', { name: 'Texte de la publication' }).fill('Le rapport.');
    await publish(dialog);
    const post = postWith(a.page, 'Le rapport.');
    await expect(post.getByRole('button', { name: 'Ouvrir Rapport de test' })).toBeVisible();
    await expect(post.getByText('2 pages')).toBeVisible();
    await a.context.close();
  });

  test('a pasted address asks for its preview, which can be removed', async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'Firefox gives no data to a paste dispatched by a script');
    const a = await memberPage(browser, 'post-link');
    const dialog = await openComposer(a.page);
    const editor = dialog.getByRole('textbox', { name: 'Texte de la publication' });
    await editor.click();
    await a.page.evaluate(() => {
      const data = new DataTransfer();
      data.setData('text/plain', 'https://example.org/rapport');
      document.activeElement?.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    });
    await expect(dialog.getByRole('link', { name: 'https://example.org/rapport' })).toBeVisible();
    // Pending, then built or failed (the address may not answer): removable in every state.
    await expect(dialog.getByText('example.org').first()).toBeVisible();
    const remove = dialog.getByRole('button', { name: 'Retirer l’aperçu' });
    await remove.click();
    await expect(remove).toBeHidden();
    await expect(dialog.getByRole('link', { name: 'https://example.org/rapport' })).toBeVisible();
    await a.context.close();
  });

  test('the public audience waits for a public page, with the way to open it', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'post-public');
    const dialog = await openComposer(a.page);
    await expect(dialog.getByText('Publier en public demande votre page publique.')).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Paramètres de confidentialité' }),
    ).toHaveAttribute('href', '/fr/settings/privacy');
    await dialog.getByRole('combobox', { name: 'Audience' }).click();
    await expect(a.page.getByRole('option', { name: 'Public' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(a.page.getByRole('option', { name: 'Membres' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await a.page.keyboard.press('Escape');
    await a.context.close();
  });

  test('a draft is found again after the page is closed', async ({ browser }) => {
    const a = await memberPage(browser, 'post-draft');
    let dialog = await openComposer(a.page);
    await dialog
      .getByRole('textbox', { name: 'Texte de la publication' })
      .pressSequentially('Un brouillon à reprendre.');
    // Written to the device after a short pause.
    await a.page.waitForTimeout(1_500);
    await a.page.reload();
    dialog = await openComposer(a.page);
    await expect(dialog.getByText('Votre brouillon a été retrouvé.')).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Texte de la publication' })).toHaveText(
      'Un brouillon à reprendre.',
    );
    await dialog.getByRole('button', { name: 'Effacer le brouillon' }).click();
    await expect(dialog.getByRole('textbox', { name: 'Texte de la publication' })).toHaveText('');
    await a.context.close();
  });
});

test.describe('reactions, comments and actions', { tag: '@critical' }, () => {
  test('reacts by a click, from the keyboard menu and by a long press', async ({ browser }) => {
    const a = await memberPage(browser, 'react-a');
    const id = await apiPost(a.page, 'Une publication à laquelle réagir.');
    await a.page.goto(`/fr/posts/${id}`);
    await hydrated(a.page);
    const post = postWith(a.page, 'Une publication à laquelle réagir.');

    const like = post.getByRole('button', { name: "J'aime", exact: true });
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(post.getByText('1 réaction')).toBeVisible();

    await post.getByRole('button', { name: 'Choisir une réaction' }).focus();
    await a.page.keyboard.press('Enter');
    await a.page.getByRole('menuitemradio', { name: 'Bravo' }).click();
    // The main button of the reactions comes first (the bar of the picker may be open too).
    const current = post.getByRole('button', { name: 'Bravo', exact: true }).first();
    await expect(current).toHaveAttribute('aria-pressed', 'true');
    await a.page.mouse.move(0, 0);
    await expect(post.getByRole('toolbar', { name: 'Réactions' })).toBeHidden();

    // A long press of a finger opens the bar of the reactions.
    await current.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true });
    await a.page.waitForTimeout(700);
    await current.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true });
    const bar = post.getByRole('toolbar', { name: 'Réactions' });
    await bar.getByRole('button', { name: 'Soutien' }).click();
    await expect(
      post.getByRole('button', { name: 'Soutien', exact: true }).first(),
    ).toHaveAttribute('aria-pressed', 'true');
    await a.page.reload();
    await expect(
      postWith(a.page, 'Une publication à laquelle réagir.').getByRole('button', {
        name: 'Soutien',
        exact: true,
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    await a.context.close();
  });

  test('comments, replies, edits and deletes a comment', async ({ browser }) => {
    const a = await memberPage(browser, 'comment-a');
    const id = await apiPost(a.page, 'Une publication à commenter.');
    await a.page.goto(`/fr/posts/${id}`);
    await hydrated(a.page);
    const thread = a.page.getByRole('region', { name: 'Commentaires' });
    // The fields of the comments offer mentions: comboboxes.
    await thread.getByRole('combobox', { name: 'Ajouter un commentaire' }).fill('Premier avis.');
    await thread.getByRole('button', { name: 'Publier' }).click();
    // The first comment, by its place: its text changes below.
    const comment = thread.getByRole('article', { name: /^Commentaire de / }).first();
    await expect(comment.getByText('Premier avis.')).toBeVisible();

    await comment.getByRole('button', { name: 'Répondre' }).click();
    await thread.getByRole('combobox', { name: /^Répondre à / }).fill('Une réponse.');
    await thread.getByRole('button', { name: 'Publier' }).last().click();
    await expect(thread.getByText('Une réponse.')).toBeVisible();

    await comment.getByRole('button', { name: 'Modifier' }).first().click();
    await comment.getByRole('combobox', { name: 'Modifier' }).fill('Premier avis, précisé.');
    await comment.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(thread.getByText('Premier avis, précisé.')).toBeVisible();
    await expect(comment.getByText(/· modifié$/)).toBeVisible();

    // The reply is the innermost comment holding its text (its parent holds it too).
    const reply = thread
      .getByRole('article', { name: /^Commentaire de / })
      .filter({ hasText: 'Une réponse.' })
      .last();
    await reply.getByRole('button', { name: 'Supprimer' }).click();
    await a.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Supprimer le commentaire' })
      .click();
    await expect(thread.getByText('Une réponse.')).toBeHidden();
    await a.context.close();
  });

  test('saves a publication, hides it and brings it back', async ({ browser }) => {
    const b = await memberPage(browser, 'save-b', { name: uniqueName('Bakary') });
    const a = await memberPage(browser, 'save-a');
    await ok(api(a.page, 'PUT', `/v1/network/follows/member/${b.member.handle}`));
    await apiPost(b.page, 'Une publication à garder.');
    await a.page.goto('/fr/feed');
    await hydrated(a.page);
    const post = postWith(a.page, 'Une publication à garder.');
    await post.getByRole('button', { name: 'Plus d’actions' }).click();
    await a.page.getByRole('menuitem', { name: 'Enregistrer' }).click();
    await expect(a.page.getByText('Publication enregistrée.')).toBeVisible();

    await post.getByRole('button', { name: 'Plus d’actions' }).click();
    await a.page.getByRole('menuitem', { name: 'Masquer de mon fil' }).click();
    await expect(postWith(a.page, 'Une publication à garder.')).toBeHidden();
    await a.page.getByRole('button', { name: 'Annuler' }).click();
    await expect(postWith(a.page, 'Une publication à garder.')).toBeVisible();

    await a.page.goto('/fr/saved');
    await expect(postWith(a.page, 'Une publication à garder.')).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('reposts with a comment, within the audience of the original', async ({ browser }) => {
    const b = await memberPage(browser, 'repost-b', { name: uniqueName('Bakary') });
    const a = await memberPage(browser, 'repost-a', { name: uniqueName('Awa') });
    const id = await apiPost(b.page, 'Une publication à repartager.');
    await a.page.goto(`/fr/posts/${id}`);
    await hydrated(a.page);
    await postWith(a.page, 'Une publication à repartager.')
      .getByRole('button', { name: 'Repartager' })
      .click();
    const dialog = a.page.getByRole('dialog', { name: 'Repartager la publication' });
    await dialog.getByRole('combobox', { name: 'Votre commentaire' }).fill('À lire.');
    await dialog.getByRole('combobox', { name: 'Audience' }).click();
    await expect(a.page.getByRole('option', { name: 'Public' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await a.page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Repartager' }).click();
    await expect(a.page.getByText('Publication repartagée.')).toBeVisible();
    await a.page.goto('/fr/feed');
    await expect(a.page.getByText(`${a.member.name} a repartagé`).first()).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('the statistics belong to the author only', async ({ browser }) => {
    const a = await memberPage(browser, 'stats-a');
    const b = await memberPage(browser, 'stats-b');
    const id = await apiPost(a.page, 'Une publication mesurée.');
    await a.page.goto(`/fr/posts/${id}`);
    await hydrated(a.page);
    await postWith(a.page, 'Une publication mesurée.')
      .getByRole('button', { name: 'Plus d’actions' })
      .click();
    await a.page.getByRole('menuitem', { name: 'Statistiques' }).click();
    await expect(
      a.page.getByRole('dialog', { name: 'Statistiques de la publication' }),
    ).toBeVisible();

    await b.page.goto(`/fr/posts/${id}`);
    await hydrated(b.page);
    await postWith(b.page, 'Une publication mesurée.')
      .getByRole('button', { name: 'Plus d’actions' })
      .click();
    await expect(b.page.getByRole('menuitem', { name: 'Enregistrer' })).toBeVisible();
    await expect(b.page.getByRole('menuitem', { name: 'Statistiques' })).toHaveCount(0);
    await a.context.close();
    await b.context.close();
  });
});

test.describe('pages of publications', { tag: '@critical' }, () => {
  test('a public publication is read by a visitor, a members one is not found', async ({
    browser,
  }) => {
    allowConsole(/status of 404 \(Not Found\)/);
    const a = await memberPage(browser, 'page-public', { name: uniqueName('Ines') });
    await ok(api(a.page, 'PATCH', '/v1/me/profile/visibility', { publicPageEnabled: true }));
    const open = await apiPost(a.page, 'Une publication ouverte à tous.', 'public');
    const closed = await apiPost(a.page, 'Une publication réservée aux membres.');

    const visitor = await browser.newContext();
    const anonymous = await visitor.newPage();
    const response = await anonymous.goto(`/fr/posts/${open}`);
    expect(response?.status()).toBe(200);
    await expect(postWith(anonymous, 'Une publication ouverte à tous.')).toBeVisible();
    await expect(anonymous.locator('meta[name="robots"]')).toHaveAttribute('content', /^index/);
    const jsonLd = await anonymous.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(jsonLd ?? '{}')).toMatchObject({ '@type': 'SocialMediaPosting' });
    await expect(anonymous.getByRole('link', { name: 'Se connecter pour réagir' })).toBeVisible();
    expect((await anonymous.goto(`/fr/posts/${closed}`))?.status()).toBe(404);
    await visitor.close();
    await a.context.close();
  });

  test('the pill brings the publications written meanwhile', async ({ browser }) => {
    const b = await memberPage(browser, 'newer-b', { name: uniqueName('Bakary') });
    const a = await memberPage(browser, 'newer-a');
    await ok(api(a.page, 'PUT', `/v1/network/follows/member/${b.member.handle}`));
    await apiPost(b.page, 'Une première publication suivie.');
    // The clock of the page runs faster than the minute between two checks.
    await a.page.clock.install();
    await a.page.goto('/fr/feed');
    await hydrated(a.page);
    await expect(postWith(a.page, 'Une première publication suivie.')).toBeVisible();

    await apiPost(b.page, 'Une publication écrite entre-temps.');
    await a.page.clock.fastForward('01:05');
    const pill = a.page.getByRole('button', { name: '1 nouvelle publication' });
    await expect(pill).toBeVisible();
    // Nothing is inserted before the pill is chosen.
    await expect(postWith(a.page, 'Une publication écrite entre-temps.')).toHaveCount(0);
    await pill.click();
    await expect(postWith(a.page, 'Une publication écrite entre-temps.')).toBeVisible();
    await a.context.close();
    await b.context.close();
  });
});

test.describe('the feed of a demonstration member', () => {
  test('comes back to the same publication and passes axe', async ({ page }) => {
    await signInWithPassword(page, 'aissatou.ba@demo.pitchorium.test', 'pitchorium-demo-2026');
    await page.waitForURL(/\/fr\/feed/);
    await hydrated(page);
    const feed = page.getByRole('feed', { name: 'Fil d’actualité' });
    await expect(feed).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    // Down the virtualized feed, to its seventh entry.
    const entry = feed.locator('[data-feed-index="6"]');
    await expect
      .poll(async () => {
        await page.mouse.wheel(0, 800);
        return entry.count();
      })
      .toBe(1);
    const author = entry.getByRole('link').first();
    const name = await author.textContent();
    // The entry is still measured as it comes into view: the click goes to the link at once.
    await author.dispatchEvent('click');
    await expect(page.getByRole('heading', { level: 1, name: name ?? '' })).toBeVisible();
    await page.goBack();
    await expect(feed.locator('[data-feed-index="6"]')).toBeInViewport();
  });

  test('a mention of a member opens their page from the publication', async ({ page }) => {
    await signInWithPassword(page, 'kofi.mensah@demo.pitchorium.test', 'pitchorium-demo-2026');
    await page.waitForURL(/\/fr\//);
    await page.goto('/fr/members/aissatou-ba');
    await hydrated(page);
    const activity = page.getByRole('region', { name: 'Activité' });
    const mention = activity.getByRole('link', { name: 'Kofi Mensah' }).first();
    await expect(mention).toBeVisible();
    await mention.click();
    await expect(page).toHaveURL(/\/fr\/members\/kofi-mensah$/);
  });
});
