import type { Page } from '@playwright/test';
import { api, expect, memberPage, ok, test } from './support';

/**
 * The realtime channel loses nothing at its start (ADR 0168): its handlers, with Zod and the
 * schemas of the payloads, are fetched ten seconds after the connection to keep the start of the
 * page light (ADR 0163), but the first event fetches them at once and every event is handled in
 * the order it arrived. A message and a notification sent within two seconds of the connection
 * show at once, well before the ten seconds.
 */

type Member = Awaited<ReturnType<typeof memberPage>>;

/** The instant the Socket.IO channel of the page confirms its connection (packet `40`). */
async function channelOpen(page: Page): Promise<number> {
  const socket = await page.waitForEvent('websocket', (ws) => ws.url().includes('/socket.io/'));
  await socket.waitForEvent('framereceived', (frame) => String(frame.payload).startsWith('40'));
  return Date.now();
}

test('a message and a notification of the first two seconds show at once', async ({ browser }) => {
  const a = await memberPage(browser, 'rt-start-a', { name: 'Awa Diallo' });
  const b = await memberPage(browser, 'rt-start-b', { name: 'Bakary Traoré' });
  const c = await memberPage(browser, 'rt-start-c', { name: 'Chidi Okeke' });
  const request = (await (
    await ok(api(a.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle }))
  ).json()) as { id: string };
  await ok(api(b.page, 'POST', `/v1/network/connection-requests/${request.id}/accept`));
  const first = (await (
    await ok(
      api(a.page, 'POST', '/v1/messaging/conversations', {
        recipientHandle: b.member.handle,
        clientMessageId: `live-${crypto.randomUUID()}`,
        body: 'Bonjour Bakary',
      }),
    )
  ).json()) as { conversationId: string };

  const opened = channelOpen(b.page);
  await b.page.goto(`/fr/messages/${first.conversationId}`);
  const connectedAt = await opened;
  const before = await unreadNotifications(b.page);
  await Promise.all([
    sendMessage(a, first.conversationId, 'Le devis arrive ce soir.'),
    // A connection request of a third member: a notification and its counter for Bakary.
    ok(api(c.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle })),
  ]);
  expect(Date.now() - connectedAt, 'both sent within two seconds').toBeLessThan(2_000);

  await expect(
    b.page.locator('[data-thread-scroller]').getByText('Le devis arrive ce soir.'),
  ).toBeVisible({ timeout: 3_000 });
  // The request of the third member: one more unread notification, pushed by the channel.
  await expect.poll(() => unreadNotifications(b.page), { timeout: 3_000 }).toBeGreaterThan(before);
  // Shown before the handlers would have been fetched without an event (ten seconds).
  expect(Date.now() - connectedAt).toBeLessThan(8_000);
  for (const member of [a, b, c]) await member.context.close();
});

async function sendMessage(from: Member, conversationId: string, body: string): Promise<void> {
  await ok(
    api(from.page, 'POST', `/v1/messaging/conversations/${conversationId}/messages`, {
      clientMessageId: `live-${crypto.randomUUID()}`,
      body,
    }),
  );
}

/** The unread notifications the header of the page counts (its accessible name). */
async function unreadNotifications(page: Page): Promise<number> {
  const name =
    (await page
      .getByRole('link', { name: /^Notifications/ })
      .first()
      .getAttribute('aria-label')) ??
    (await page
      .getByRole('link', { name: /^Notifications/ })
      .first()
      .innerText());
  return Number(/(\d+) notifications? non lues?/.exec(name)?.[1] ?? 0);
}
