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

interface Counters {
  notifications: number;
  invitations: { connections: number };
}

/**
 * The instant the Socket.IO channel of the page confirms its connection (packet `40`), and the
 * `counters` events it receives from then on, with the instant each arrived.
 */
async function channelOpen(
  page: Page,
): Promise<{ at: number; counters: { at: number; value: Counters }[] }> {
  const socket = await page.waitForEvent('websocket', (ws) => ws.url().includes('/socket.io/'));
  const counters: { at: number; value: Counters }[] = [];
  socket.on('framereceived', (frame) => {
    const text = String(frame.payload);
    if (!text.startsWith('42')) return;
    let event: string;
    let payload: { counters?: Counters };
    try {
      [event, payload] = JSON.parse(text.slice(2)) as [string, { counters?: Counters }];
    } catch {
      return;
    }
    if (event === 'counters' && payload.counters) {
      counters.push({ at: Date.now(), value: payload.counters });
    }
  });
  await socket.waitForEvent('framereceived', (frame) => String(frame.payload).startsWith('40'));
  return { at: Date.now(), counters };
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
  const { at: connectedAt, counters } = await opened;
  await Promise.all([
    sendMessage(a, first.conversationId, 'Le devis arrive ce soir.'),
    // A connection request of a third member: a notification and its counter for Bakary.
    ok(api(c.page, 'POST', '/v1/network/connection-requests', { handle: b.member.handle })),
  ]);
  expect(Date.now() - connectedAt, 'both sent within two seconds').toBeLessThan(2_000);

  await expect(
    b.page.locator('[data-thread-scroller]').getByText('Le devis arrive ce soir.'),
  ).toBeVisible({ timeout: 3_000 });
  const messageShownAt = Date.now();
  // The request of the third member: once the worker has written it (its delay grows with the
  // backlog of the worker, not with the page), the channel pushes the counters with one pending
  // invitation, and the page shows their notifications at once.
  await expect
    .poll(() => counters.some((event) => event.value.invitations.connections === 1), {
      timeout: 30_000,
    })
    .toBe(true);
  const pushed = counters.find((event) => event.value.invitations.connections === 1)!;
  await expect
    .poll(() => unreadNotifications(b.page), { timeout: 3_000 })
    .toBe(pushed.value.notifications);
  // The message, carried by the channel alone, before the handlers would have been fetched
  // without an event (ten seconds).
  expect(messageShownAt - connectedAt).toBeLessThan(8_000);
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
