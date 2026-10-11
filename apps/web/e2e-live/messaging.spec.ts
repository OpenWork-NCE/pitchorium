import type { Browser, Page } from '@playwright/test';
import {
  allowConsole,
  api,
  expect,
  hydrated,
  linkFromInbox,
  type LiveMember,
  memberPage,
  ok,
  PASSWORD,
  pngImage,
  test,
  twoPagePdf,
  WEB_URL,
} from './support';

/**
 * The messaging and the notifications against the real api (PROMPT FRONT 6): members created by
 * the api in their own browser contexts, the conversation between connections in real time on
 * two devices, a first message out of network that becomes a request, the minimum profile asked
 * before it, files, a shared publication out of the audience, an old history, a send made
 * offline, an introduction, a block, the notifications and their actions, the copy of an unread
 * message by email and its one-click unsubscribe.
 */

type Member = Awaited<ReturnType<typeof memberPage>>;

/** `a` asks `b` to connect, `b` accepts: both through the api. */
async function connect(a: Member, b: Member): Promise<void> {
  const request = (await (
    await ok(api(a.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle }))
  ).json()) as { id: string };
  await ok(api(b.page, 'POST', `/v1/network/connection-requests/${request.id}/accept`));
}

/** A first message through the api; the id of the conversation. */
async function write(from: Member, to: LiveMember, body: string): Promise<string> {
  const message = (await (
    await ok(
      api(from.page, 'POST', '/v1/messaging/conversations', {
        recipientHandle: to.handle,
        clientMessageId: `live-${crypto.randomUUID()}`,
        body,
      }),
    )
  ).json()) as { conversationId: string };
  return message.conversationId;
}

async function send(from: Member, conversationId: string, body: string): Promise<void> {
  await ok(
    api(from.page, 'POST', `/v1/messaging/conversations/${conversationId}/messages`, {
      clientMessageId: `live-${crypto.randomUUID()}`,
      body,
    }),
  );
}

/** The same member on a second device: another browser context signed in with the password. */
async function secondDevice(browser: Browser, member: LiveMember): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await ok(
    api(page, 'POST', '/v1/auth/sign-in/email', { email: member.email, password: PASSWORD }),
  );
  return page;
}

/** The conversation is hydrated once its composer is there (it loads after the page). */
async function openConversation(page: Page, conversationId: string): Promise<void> {
  await page.goto(`/fr/messages/${conversationId}`);
  await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
  await hydrated(page);
}

const thread = (page: Page) => page.locator('[data-thread-scroller]');

test.describe('messaging', () => {
  test(
    'a conversation between connections reaches two devices in real time, then its receipt',
    { tag: '@critical' },
    async ({ browser }) => {
      const a = await memberPage(browser, 'msg-rt-a', { name: 'Awa Diallo' });
      const b = await memberPage(browser, 'msg-rt-b', { name: 'Bakary Traoré' });
      await connect(a, b);
      const conversation = await write(a, b.member, 'Bonjour Bakary');
      const phone = await secondDevice(browser, b.member);
      await openConversation(a.page, conversation);
      await openConversation(phone, conversation);
      await b.page.goto('/fr/messages');
      await hydrated(b.page);

      const field = a.page.getByRole('textbox', { name: 'Votre message' });
      await field.fill('Le dossier est prêt, je te l’envoie demain.');
      await field.press('Enter');
      await expect(thread(a.page).getByText('Le dossier est prêt')).toBeVisible();
      // Both devices of Bakary receive it without a reload: the open thread and the list.
      await expect(thread(phone).getByText('Le dossier est prêt')).toBeVisible();
      await expect(b.page.getByRole('link', { name: /Awa Diallo/ })).toContainText(
        'Le dossier est prêt',
      );
      // Read on the phone (the thread shows its end): Awa sees « Lu ».
      await expect(a.page.locator('[data-send-state="read"]')).toBeVisible();
      await a.page.context().close();
      await b.page.context().close();
      await phone.context().close();
    },
  );

  test(
    'a first message out of network becomes a request, then the recipient accepts it',
    { tag: '@critical' },
    async ({ browser }) => {
      const a = await memberPage(browser, 'msg-req-a', { name: 'Awa Diallo' });
      const b = await memberPage(browser, 'msg-req-b', { name: 'Bakary Traoré' });
      const c = await memberPage(browser, 'msg-req-c', { name: 'Chidi Okeke' });
      // Second degree through Chidi: the policy by default admits a request.
      await connect(a, c);
      await connect(c, b);

      await a.page.goto(`/fr/members/${b.member.handle}`);
      await hydrated(a.page);
      await a.page.getByRole('link', { name: 'Message', exact: true }).click();
      await expect(a.page.getByText('Ce premier message sera une demande')).toBeVisible();
      const field = a.page.getByRole('textbox', { name: 'Votre message' });
      await field.fill('Bonjour Bakary, Chidi m’a parlé de votre coopérative.');
      await field.press('Enter');
      await expect(a.page).toHaveURL(/\/fr\/messages\/[\w-]+$/);
      await expect(a.page.getByText('Demande envoyée')).toBeVisible();

      await b.page.goto('/fr/messages?filter=requests');
      await hydrated(b.page);
      await b.page.getByRole('link', { name: /Awa Diallo/ }).click();
      await expect(b.page.getByText('Awa Diallo souhaite vous écrire')).toBeVisible();
      await expect(b.page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
      await b.page.getByRole('button', { name: 'Accepter' }).click();
      await expect(b.page.getByText('Awa Diallo souhaite vous écrire')).toHaveCount(0);

      await a.page.reload();
      await expect(a.page.getByText('Demande envoyée')).toHaveCount(0);
      await expect(a.page.getByRole('textbox', { name: 'Votre message' })).toBeEnabled();
      for (const member of [a, b, c]) await member.context.close();
    },
  );

  test('the minimum profile is asked before a first message out of network', async ({
    browser,
  }) => {
    // The first send is refused for the missing profile, then goes again (ADR 0105).
    allowConsole(/status of 403 \(Forbidden\)/);
    const a = await memberPage(browser, 'msg-min-a', { name: 'Awa Diallo', profile: false });
    const b = await memberPage(browser, 'msg-min-b', { name: 'Bakary Traoré' });
    // Bakary accepts a request from any verified member: Awa, without network, may write.
    await ok(
      api(b.page, 'PUT', '/v1/me/messaging/settings', { messagePolicy: 'verified_members' }),
    );
    await a.page.goto(`/fr/messages/new?to=${b.member.handle}`);
    const field = a.page.getByRole('textbox', { name: 'Votre message' });
    await expect(field).toBeVisible();
    await hydrated(a.page);
    await field.fill('Bonjour Bakary');
    await field.press('Enter');
    const form = a.page.getByRole('form', { name: 'Profil minimum' });
    await expect(form).toBeVisible();
    await form.getByLabel('Titre').fill('Fondatrice de Sahel Agri');
    await form.getByRole('combobox').click();
    await a.page.keyboard.type('Sén');
    await a.page.getByRole('option', { name: 'Sénégal' }).click();
    await form.getByRole('button', { name: 'Enregistrer et continuer' }).click();
    // The send goes again once the profile is complete.
    await expect(a.page).toHaveURL(/\/fr\/messages\/[\w-]+$/);
    await expect(thread(a.page).getByText('Bonjour Bakary')).toBeVisible();
    for (const member of [a, b]) await member.context.close();
  });

  test('an image with its text alternative and a PDF reach the other participant', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'msg-file-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-file-b', { name: 'Bakary Traoré' });
    await connect(a, b);
    const conversation = await write(a, b.member, 'Voici les documents');
    await openConversation(a.page, conversation);
    const pdf = { ...twoPagePdf(), name: 'bilan-2026.pdf' };
    const chooser = a.page.waitForEvent('filechooser');
    await a.page.getByRole('button', { name: 'Joindre une image ou un PDF' }).click();
    await (await chooser).setFiles([await pngImage(a.page, 800, 600), pdf]);
    await a.page
      .getByRole('textbox', { name: 'Texte alternatif de image.png' })
      .fill('Parcelle irriguée par la pompe solaire');
    // Both files checked by the worker, the send button enabled.
    const sendButton = a.page.getByRole('button', { name: 'Envoyer' });
    await expect(sendButton).toBeEnabled({ timeout: 60_000 });
    await sendButton.click();

    await openConversation(b.page, conversation);
    await expect(
      thread(b.page).getByRole('img', { name: 'Parcelle irriguée par la pompe solaire' }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(thread(b.page).getByText('bilan-2026').first()).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test('a publication shared out of the audience of a reader shows a neutral mention', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'msg-share-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-share-b', { name: 'Bakary Traoré' });
    const c = await memberPage(browser, 'msg-share-c', { name: 'Chidi Okeke' });
    await connect(a, c);
    await connect(c, b);
    // For the connections of Awa only: Bakary, out of network, is out of the audience.
    const post = (await (
      await ok(
        api(a.page, 'POST', '/v1/posts', {
          text: 'Notre bilan, pour mes connexions.',
          visibility: 'connections',
        }),
      )
    ).json()) as { id: string };
    const message = (await (
      await ok(
        api(a.page, 'POST', '/v1/messaging/conversations', {
          recipientHandle: b.member.handle,
          clientMessageId: `live-${crypto.randomUUID()}`,
          body: 'Mon bilan',
          sharedPostId: post.id,
        }),
      )
    ).json()) as { conversationId: string };
    await openConversation(a.page, message.conversationId);
    await expect(thread(a.page).getByText('Notre bilan, pour mes connexions.')).toBeVisible();
    await openConversation(b.page, message.conversationId);
    await expect(
      thread(b.page).getByText('Cette publication n’est pas visible pour vous.'),
    ).toBeVisible();
    await expect(thread(b.page).getByText('Notre bilan, pour mes connexions.')).toHaveCount(0);
    for (const member of [a, b, c]) await member.context.close();
  });

  test('an old history is read without moving what was read', async ({ browser }) => {
    const a = await memberPage(browser, 'msg-old-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-old-b', { name: 'Bakary Traoré' });
    await connect(a, b);
    const conversation = await write(a, b.member, 'Message 1');
    for (let index = 2; index <= 70; index += 1) {
      await send(index % 2 ? a : b, conversation, `Message ${index}`);
    }
    await openConversation(b.page, conversation);
    await expect.poll(() => thread(b.page).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    const anchor = b.page.locator('[data-message-sequence="21"]');
    await thread(b.page).evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(b.page.locator('[data-message-sequence="1"]')).toBeAttached();
    const top = await anchor.evaluate((element) => element.getBoundingClientRect().top);
    await b.page.waitForTimeout(300);
    expect(
      Math.abs((await anchor.evaluate((element) => element.getBoundingClientRect().top)) - top),
    ).toBeLessThan(2);
    await a.context.close();
    await b.context.close();
  });

  test('a message sent offline survives the closing of the tab and goes once', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'msg-off-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-off-b', { name: 'Bakary Traoré' });
    await connect(a, b);
    const conversation = await write(a, b.member, 'Bonjour');
    await openConversation(a.page, conversation);
    await a.context.setOffline(true);
    const field = a.page.getByRole('textbox', { name: 'Votre message' });
    await field.fill('Écrit dans le train, sans réseau');
    await field.press('Enter');
    await expect(a.page.locator('[data-pending="waiting"]')).toBeVisible();
    // Kept on the device, then the tab closes.
    await a.page.waitForTimeout(500);
    await a.page.close();
    await a.context.setOffline(false);
    const again = await a.context.newPage();
    await openConversation(again, conversation);
    await expect(thread(again).getByText('Écrit dans le train, sans réseau')).toBeVisible();
    await expect
      .poll(async () => {
        const page = (await (
          await ok(api(b.page, 'GET', `/v1/messaging/conversations/${conversation}/messages`))
        ).json()) as { items: { body: string | null }[] };
        return page.items.filter((item) => item.body === 'Écrit dans le train, sans réseau').length;
      })
      .toBe(1);
    await a.context.close();
    await b.context.close();
  });

  test('an introduction of three ends in a group conversation opened by its note', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'msg-intro-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-intro-b', { name: 'Bakary Traoré' });
    const c = await memberPage(browser, 'msg-intro-c', { name: 'Chidi Okeke' });
    await connect(a, b);
    await connect(a, c);
    await a.page.goto(`/fr/members/${b.member.handle}`);
    await hydrated(a.page);
    await a.page.getByRole('button', { name: 'Présenter à…' }).click();
    const dialog = a.page.getByRole('dialog', { name: 'Présenter Bakary Traoré à…' });
    await dialog.getByRole('combobox').click();
    await a.page.getByRole('option', { name: /Chidi Okeke/ }).click();
    await dialog
      .getByRole('textbox')
      .fill('Bakary, Chidi cherche des producteurs de karité : parlez-vous.');
    await dialog.getByRole('button', { name: 'Envoyer l’introduction' }).click();
    await expect(dialog).toHaveCount(0);

    // Bakary answers from the notification, Chidi from the box of the introductions.
    await b.page.goto('/fr/notifications');
    await hydrated(b.page);
    await expect(async () => {
      await b.page.reload();
      await expect(
        b.page.getByRole('button', { name: 'Accepter l’introduction de Awa Diallo' }),
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await b.page.getByRole('button', { name: 'Accepter l’introduction de Awa Diallo' }).click();
    await expect(b.page.getByText('Introduction acceptée.').first()).toBeVisible();
    await c.page.goto('/fr/introductions');
    await hydrated(c.page);
    await c.page.getByRole('button', { name: 'Accepter' }).click();
    await expect(c.page.getByRole('link', { name: 'Ouvrir la conversation' })).toBeVisible();
    await c.page.getByRole('link', { name: 'Ouvrir la conversation' }).click();
    await expect(
      thread(c.page).getByText('Bakary, Chidi cherche des producteurs de karité : parlez-vous.'),
    ).toBeVisible();
    for (const member of [a, b, c]) await member.context.close();
  });

  test('a block during a conversation refuses the send and hides it, neutrally', async ({
    browser,
  }) => {
    // The conversation answers 404 once blocked: the send, then the page read again.
    allowConsole(/status of 404 \(Not Found\)/);
    const a = await memberPage(browser, 'msg-block-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-block-b', { name: 'Bakary Traoré' });
    await connect(a, b);
    const conversation = await write(a, b.member, 'Bonjour');
    await openConversation(a.page, conversation);
    await ok(api(b.page, 'PUT', `/v1/network/blocks/${a.member.handle}`));
    const field = a.page.getByRole('textbox', { name: 'Votre message' });
    await field.fill('Tu as reçu le dossier ?');
    await field.press('Enter');
    await expect(a.page.locator('[data-pending="failed"]')).toBeVisible();
    await a.page.reload();
    await expect(
      a.page.getByRole('heading', { name: 'Cette conversation n’est plus disponible' }),
    ).toBeVisible();
    await a.context.close();
    await b.context.close();
  });

  test(
    'a grouped reaction is notified, then a connection request is accepted from its notification',
    { tag: '@critical' },
    async ({ browser }) => {
      const a = await memberPage(browser, 'ntf-a', { name: 'Awa Diallo' });
      const b = await memberPage(browser, 'ntf-b', { name: 'Bakary Traoré' });
      const c = await memberPage(browser, 'ntf-c', { name: 'Chidi Okeke' });
      const d = await memberPage(browser, 'ntf-d', { name: 'Dalia Mensah' });
      const post = (await (
        await ok(api(a.page, 'POST', '/v1/posts', { text: 'Notre récolte', visibility: 'members' }))
      ).json()) as { id: string };
      await ok(api(b.page, 'PUT', `/v1/posts/${post.id}/reaction`, { type: 'bravo' }));
      await ok(api(c.page, 'PUT', `/v1/posts/${post.id}/reaction`, { type: 'support' }));
      await ok(api(d.page, 'POST', '/v1/network/connection-requests', { handle: a.member.handle }));

      await a.page.goto('/fr/notifications');
      await hydrated(a.page);
      await expect(async () => {
        await a.page.reload();
        await expect(
          a.page.getByRole('link', { name: /et 1 autres ont réagi à votre publication/ }),
        ).toBeVisible({ timeout: 2_000 });
        await expect(a.page.getByRole('button', { name: 'Accepter Dalia Mensah' })).toBeVisible({
          timeout: 2_000,
        });
      }).toPass({ timeout: 30_000 });
      await a.page.getByRole('button', { name: 'Accepter Dalia Mensah' }).click();
      await expect(a.page.getByText('Vous êtes connectés avec Dalia Mensah.')).toBeVisible();
      for (const member of [a, b, c, d]) await member.context.close();
    },
  );

  test('the copy of an unread message is emailed, then turned off in one click', async ({
    browser,
  }) => {
    const a = await memberPage(browser, 'msg-mail-a', { name: 'Awa Diallo' });
    const b = await memberPage(browser, 'msg-mail-b', { name: 'Bakary Traoré' });
    await connect(a, b);
    await b.page.goto('/fr/settings/messaging');
    await hydrated(b.page);
    const copy = b.page.getByRole('switch', { name: 'Copie par email des messages non lus' });
    const saved = b.page.waitForResponse(
      (response) => response.url().includes('/v1/me/notification-preferences') && response.ok(),
    );
    await copy.click();
    await saved;
    await write(a, b.member, 'Avez-vous lu notre proposition ?');
    // Unread one minute later (the delay of the stack of the journeys): the copy leaves.
    const link = await linkFromInbox(
      b.member.email,
      // The page of the web app (the footer), not the address of the api (`List-Unsubscribe`).
      /https?:\/\/[^\s"<>/]+\/(?:fr\/|en\/)?unsubscribe\?token=[\w.-]+/,
      120_000,
      /nouveaux? messages? de/i,
    );
    // The link of the email carries no language: the browser of the reader chooses it.
    const visitor = await (await browser.newContext({ locale: 'fr-FR' })).newPage();
    await visitor.goto(link.replace(/^http:\/\/localhost:\d+/, WEB_URL));
    await expect(visitor.getByText('Vous ne recevrez plus les emails « Messages ».')).toBeVisible();
    await b.page.reload();
    await expect(
      b.page.getByRole('switch', { name: 'Copie par email des messages non lus' }),
    ).toHaveAttribute('aria-checked', 'false');
    await visitor.context().close();
    await a.context.close();
    await b.context.close();
  });
});
