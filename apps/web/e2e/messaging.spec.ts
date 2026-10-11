import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

/**
 * The messaging and the notifications (PROMPT FRONT 6) against the stub api
 * (e2e/support/stub-messaging.mjs): the list and its filters, a long conversation and its
 * history read without a jump, an optimistic send, the draft of a conversation, a request
 * answered, a first message out of network, the notifications and their pill, the preferences
 * and the page of the unsubscribe link.
 */
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const LONG = '/fr/messages/0192f4a0-6000-7000-8000-000000000001';

/** The thread at its end and still: its files drawn, nothing left to move. */
async function settledThread(page: Page): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const now = await page
        .locator('[data-thread-scroller]')
        .evaluate((e) =>
          JSON.stringify([e.scrollHeight, Math.round(e.scrollTop + e.clientHeight)]),
        );
      const [height, bottom] = JSON.parse(now) as [number, number];
      const still = now === previous && bottom >= height - 1;
      previous = now;
      return still;
    })
    .toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

test.describe('messaging', () => {
  test('lists the conversations, filters them and searches a participant', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/messages');
    const list = page.getByRole('complementary', { name: 'Conversations' });
    await expect(list.getByRole('link', { name: /Kofi Mensah/ })).toBeVisible();
    await expect(list.getByRole('link', { name: /Nadia Benali et Fatou Sall/ })).toBeVisible();
    await list.getByRole('button', { name: 'Demandes' }).click();
    await expect(page).toHaveURL(/filter=requests/);
    await expect(list.getByRole('link', { name: /Grace Wanjiru/ })).toBeVisible();
    await list.getByRole('button', { name: 'Toutes' }).click();
    await list.getByRole('searchbox').fill('nadia');
    await expect(list.getByRole('link', { name: /Kofi Mensah/ })).toHaveCount(0);
    await expect(list.getByRole('link', { name: /Nadia Benali/ })).toBeVisible();
  });

  test('reads older messages without moving what was read, then sends at once', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.goto(LONG);
    const thread = page.locator('[data-thread-scroller]');
    // The conversation opens at its last message: the PDF and the publications it shares.
    await expect(page.getByText('Note de synthèse, saison sèche').first()).toBeVisible();
    await expect(page.getByText('Cette publication n’est pas visible pour vous.')).toBeVisible();
    // Hydrated, the thread shows its end; scrolled to the top, older messages arrive above the
    // one read, which stays in place.
    await expect.poll(() => thread.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const anchor = page.locator('[data-message-sequence="31"]');
    await thread.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(page.locator('[data-message-sequence="1"]')).toBeAttached();
    const top = await anchor.evaluate((element) => element.getBoundingClientRect().top);
    await page.waitForTimeout(300);
    expect(
      Math.abs((await anchor.evaluate((element) => element.getBoundingClientRect().top)) - top),
    ).toBeLessThan(2);

    // Shift Enter adds a line, Enter sends: the message shows at once, then sent.
    const field = page.getByRole('textbox', { name: 'Votre message' });
    await field.fill('Merci Kofi,');
    await field.press('Shift+Enter');
    await field.pressSequentially('à jeudi.');
    await field.press('Enter');
    await expect(field).toHaveValue('');
    await expect(thread.getByText('Merci Kofi,\nà jeudi.')).toBeVisible();
    await expect(page.locator('[data-send-state="sent"]').last()).toBeVisible();
    const writes = await stub(request).writes();
    expect(writes.filter((write) => write.route === 'message')).toHaveLength(1);
  });

  test('keeps the draft of a conversation on the device', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto(LONG);
    const field = page.getByRole('textbox', { name: 'Votre message' });
    await field.fill('Un brouillon pour Kofi');
    await page.waitForTimeout(600);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Votre message' })).toHaveValue(
      'Un brouillon pour Kofi',
    );
    await page.goto('/fr/messages/0192f4a0-6000-7000-8000-000000000002');
    await expect(page.getByRole('textbox', { name: 'Votre message' })).toHaveValue('');
  });

  test('answers a request, and says a first message out of network is one', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/messages/0192f4a0-6000-7000-8000-000000000003');
    await expect(page.getByText('Grace Wanjiru souhaite vous écrire')).toBeVisible();
    // The composer loads after the hydration: the page answers from then on.
    await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
    await page.getByRole('button', { name: 'Accepter' }).click();
    await expect(page.getByText('Grace Wanjiru souhaite vous écrire')).toHaveCount(0);

    await page.goto('/fr/messages/new?to=claudine-pierre-louis');
    await expect(page.getByText('Ce premier message sera une demande')).toBeVisible();
    await page.goto('/fr/messages/new?to=koffi-agbodjan');
    await expect(
      page.getByRole('heading', { name: 'Ce membre ne reçoit pas de message de votre part' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Votre message' })).toHaveCount(0);
    // A conversation that exists opens instead.
    await page.goto('/fr/messages/new?to=kofi-mensah');
    await expect(page).toHaveURL(LONG);
  });
});

test.describe('notifications', () => {
  test('groups, filters, opens and removes, and waits for the pill to show new ones', async ({
    page,
    request,
  }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/notifications');
    await expect(
      page.getByRole('link', { name: /Kofi Mensah et 12 autres ont réagi à votre publication/ }),
    ).toBeVisible();
    // A page still to come is never a link.
    await expect(page.locator('[data-notification-type="moderation_decision"] a')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mentions' }).click();
    await expect(page.locator('[data-notification-type]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Tout', exact: true }).click();

    const before = await page.locator('[data-notification-type]').count();
    // Arrived in real time: nothing moves until the pill is pressed.
    await expect
      .poll(async () => {
        const response = await request.post(`${API_ORIGIN}/__test/emit`, {
          data: {
            event: 'notifications:notification',
            payload: {
              notification: {
                id: '0192f4a0-6300-7000-8000-000000000001',
                type: 'reaction',
                priority: 'normal',
                actors: [],
                actorCount: 14,
                eventCount: 15,
                target: { type: 'post', key: 'k', path: '/posts/k' },
                data: {},
                excerpt: null,
                read: false,
                createdAt: '2026-10-10T10:00:00.000Z',
                updatedAt: '2026-10-10T10:00:00.000Z',
              },
            },
          },
        });
        return ((await response.json()) as { sockets: number }).sockets;
      })
      .toBeGreaterThan(0);
    const pill = page.getByRole('button', { name: '1 nouvelle notification' });
    await expect(pill).toBeVisible();
    expect(await page.locator('[data-notification-type]').count()).toBe(before);
    await pill.click();
    await expect(pill).toHaveCount(0);

    await page
      .locator('[data-notification-type="mention"]')
      .getByRole('button', { name: 'Supprimer la notification' })
      .click();
    await expect(page.locator('[data-notification-type="mention"]')).toHaveCount(0);
    const writes = await stub(request).writes();
    expect(writes.some((write) => write.route === 'notification-delete')).toBe(true);
  });

  test('sets the preferences by type and channel, the essential ones locked', async ({ page }) => {
    await signIn(page, MEMBER);
    await page.goto('/fr/settings/notifications');
    const security = page.getByRole('switch', { name: 'Sécurité du compte : Email' });
    await expect(security).toBeDisabled();
    await expect(page.getByText('Un résumé chaque jour, à partir de 08:00.')).toBeVisible();
    const comments = page.getByRole('switch', { name: 'Commentaires : Email' });
    await comments.click();
    await expect(comments).toHaveAttribute('aria-checked', 'false');
  });

  test('turns an email off from its link, without a session, and undoes it', async ({ page }) => {
    await page.goto('/fr/unsubscribe?token=stub-message-token-0001');
    await expect(page.getByText('Vous ne recevrez plus les emails « Messages ».')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler la désinscription' }).click();
    await expect(page.getByText('Vous recevez de nouveau les emails « Messages ».')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Régler mes notifications' })).toBeVisible();
    await expect(page.getByText('Vous vous connecterez d’abord.')).toBeVisible();
  });
});

test.describe('messaging accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`has no violation in the messages and the notifications (${colorScheme})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signIn(page, MEMBER);
      for (const path of [
        '/fr/messages',
        LONG,
        '/fr/messages/0192f4a0-6000-7000-8000-000000000003',
        '/fr/introductions',
        '/fr/notifications',
        '/fr/settings/messaging',
        '/fr/settings/notifications',
      ]) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const audit = await new AxeBuilder({ page }).include('main').analyze();
        expect(audit.violations, path).toEqual([]);
      }
      await context.close();
    });
  }
});

/** Reference screenshots of a conversation and of the notifications, in the Playwright image. */
test.describe('messaging screenshots', () => {
  test.skip(!process.env.PLAYWRIGHT_IMAGE, 'Screenshots compare in the Playwright image only.');
  test.skip(({ browserName }) => browserName !== 'chromium', 'References are drawn by Chromium.');
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`conversation and notifications ${colorScheme}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signIn(page, MEMBER);
      await page.goto(LONG);
      await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await settledThread(page);
      await expect(page.locator('main')).toHaveScreenshot(`conversation-${colorScheme}.png`);
      await page.goto('/fr/notifications');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).toHaveScreenshot(`notifications-${colorScheme}.png`);
      await context.close();
    });
  }
});
