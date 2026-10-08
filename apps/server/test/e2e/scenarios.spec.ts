import { randomUUID } from 'node:crypto';
import { strFromU8, unzipSync } from 'fflate';
import type { Socket } from 'socket.io-client';
import { afterAll, describe, expect, inject, it } from 'vitest';
import { query } from '../integration/support/database';
import { linkIn, Mailpit } from '../integration/support/mailpit';
import { Browser, demo, eventually } from './support/client';

const eur = (amount: number) => ({ amountMinor: String(amount * 100), currency: 'EUR' });
const mailpit = new Mailpit();
const sockets: Socket[] = [];

/** The next event `name` on the socket that `accept` takes. */
function next<T>(socket: Socket, name: string, accept: (payload: T) => boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No ${name} event`)), 30_000);
    const listener = (payload: T) => {
      if (!accept(payload)) return;
      clearTimeout(timer);
      socket.off(name, listener);
      resolve(payload);
    };
    socket.on(name, listener);
  });
}

async function connect(browser: Browser): Promise<Socket> {
  const socket = await browser.socket();
  sockets.push(socket);
  return socket;
}

/** Sign-up with the link received by email, terms accepted: a new member as in production. */
async function newMember(name: string): Promise<Browser & { email: string; handle: string }> {
  const email = `${name.toLowerCase().replaceAll(' ', '.')}.${Date.now()}@example.test`;
  const browser = new Browser();
  const signedUp = await browser.post('/v1/auth/sign-up/email', {
    email,
    password: 'end-to-end password 2026',
    name,
    callbackURL: `${inject('webOrigin')}/welcome`,
  });
  expect(signedUp.status).toBe(200);
  const message = await mailpit.waitFor(email, 'Confirm');
  const link = new URL(linkIn(message, `${inject('apiUrl')}/v1/auth/verify-email`));
  expect((await browser.get(`${link.pathname}${link.search}`)).status).toBe(302);
  await browser.signIn(email, 'end-to-end password 2026');
  const legal = await browser.get('/v1/legal-documents/current');
  const accepted = await browser.post('/v1/me/legal-acceptances', {
    termsVersion: legal.body.termsVersion,
    privacyVersion: legal.body.privacyVersion,
    adultDeclaration: true,
  });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
  const profile = await browser.get('/v1/me/profile');
  return Object.assign(browser, { email, handle: profile.body.handle as string });
}

afterAll(() => {
  for (const socket of sockets) socket.disconnect();
});

describe('holder', () => {
  it('creates, publishes and collects a contribution notified in real time', async () => {
    const holder = await demo('aissatou-ba');
    const created = await holder.post('/v1/projects', {
      title: 'Séchoirs solaires de Podor',
      summary: 'Des séchoirs solaires pour la mangue des coopératives de Podor.',
      description: 'Une coopérative de femmes transforme la mangue sur place.',
      sectorCode: 'agriculture_forestry_fishing',
      impactArea: 'Podor',
      countryCodes: ['SN'],
      instruments: ['donation'],
      goal: eur(5_000),
      durationDays: 30,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const projectId = created.body.id as string;
    const tiers = await holder.call('PUT', `/v1/projects/${projectId}/tiers`, {
      tiers: [{ threshold: eur(5_000), description: 'Trois séchoirs' }],
    });
    expect(tiers.status, JSON.stringify(tiers.body)).toBe(200);
    const published = await holder.post(`/v1/projects/${projectId}/publish`, {
      publicDisplayConsent: true,
    });
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    expect(published.body.status).toBe('funding');
    const anonymous = await new Browser().get(`/v1/public/projects/${published.body.slug}`);
    expect(anonymous.status).toBe(200);

    // A contributor pays at the simulated provider, the holder is notified on the socket.
    const socket = await connect(holder);
    const notified = next<{ notification: { type: string } }>(
      socket,
      'notifications:notification',
      ({ notification }) => notification.type === 'project_contribution',
    );
    const contributor = await demo('kofi-mensah');
    const contribution = await contributor.post(`/v1/projects/${projectId}/contributions`, {
      kind: 'donation',
      amount: eur(30),
      method: 'card',
      publicDisplay: true,
    });
    expect(contribution.status, JSON.stringify(contribution.body)).toBe(201);
    const paid = await fetch(`${contribution.body.paymentUrl as string}/succeed`, {
      method: 'POST',
    });
    expect(paid.status).toBeLessThan(400);
    await eventually(
      () => contributor.get(`/v1/me/contributions/${contribution.body.id as string}`),
      (reply) => reply.body.status === 'succeeded',
    );
    await notified;
    const supporters = await new Browser().get(`/v1/public/projects/${projectId}/supporters`);
    expect(supporters.body.contributionCount).toBe(1);
  });
});

describe('social', () => {
  it('connects two new members who then exchange a message in real time', async () => {
    const ama = await newMember('Ama Test');
    const kwame = await newMember('Kwame Test');
    const requested = await ama.post('/v1/network/connection-requests', { handle: kwame.handle });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    const accepted = await kwame.post(
      `/v1/network/connection-requests/${requested.body.id as string}/accept`,
    );
    expect(accepted.status).toBe(200);

    const socket = await connect(kwame);
    const received = next<{ message: { body: string } }>(
      socket,
      'messaging:message',
      ({ message }) => message.body === 'Bonjour Kwame !',
    );
    const sent = await ama.post('/v1/messaging/conversations', {
      recipientHandle: kwame.handle,
      clientMessageId: randomUUID(),
      body: 'Bonjour Kwame !',
    });
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    await received;
  });
});

describe('moderation', () => {
  it('takes a notice without account to a decision with its statement and the appeal path', async () => {
    const [post] = await query<{ id: string }>(
      `SELECT p.id FROM content.posts p JOIN profiles.profiles f ON f.user_id = p.author_id
       WHERE f.handle = 'aissatou-ba' AND p.visibility = 'public' AND p.deleted_at IS NULL
       ORDER BY p.created_at LIMIT 1`,
    );
    const notice = await new Browser().post('/v1/public/reports', {
      targetType: 'post',
      targetId: post!.id,
      details: 'Ce contenu reproduit un document confidentiel.',
      reporterEmail: 'notifier@example.test',
      goodFaith: true,
    });
    expect(notice.status, JSON.stringify(notice.body)).toBe(201);

    const moderator = await demo('claudine-pierre-louis');
    await moderator.enableTwoFactor();
    const queue = await eventually(
      () => moderator.get('/v1/admin/moderation/cases'),
      (reply) => reply.body.items?.some((item: { targetId: string }) => item.targetId === post!.id),
    );
    const moderationCase = queue.body.items.find(
      (item: { targetId: string }) => item.targetId === post!.id,
    );
    const author = await demo('aissatou-ba');
    const socket = await connect(author);
    const notified = next<{ notification: { type: string } }>(
      socket,
      'notifications:notification',
      ({ notification }) => notification.type === 'moderation_decision',
    );
    const decided = await moderator.post(
      `/v1/admin/moderation/cases/${moderationCase.id as string}/decisions`,
      {
        kind: 'hide',
        reason: 'illegal_content',
        ground: 'law',
        statement: 'Le document reproduit est confidentiel : la publication est masquée.',
      },
    );
    expect(decided.status, JSON.stringify(decided.body)).toBe(201);
    await notified;
    const standing = await author.get('/v1/me/moderation');
    const decision = standing.body.decisions.find(
      (item: { id: string }) => item.id === decided.body.id,
    );
    expect(decision).toMatchObject({ kind: 'hide' });
    expect(decision.statement).toContain('confidentiel');
    expect((await new Browser().get(`/v1/public/posts/${post!.id}`)).status).toBe(404);
    await mailpit.waitFor('notifier@example.test', '');
  });
});

describe('gdpr', () => {
  it('exports a member archive, then erases the account', async () => {
    const member = await newMember('Nora Test');
    const requested = await member.post('/v1/me/privacy/exports');
    expect(requested.status).toBe(201);
    const overview = await eventually(
      () => member.get('/v1/me/privacy'),
      (reply) => reply.body.exports?.[0]?.status === 'ready',
    );
    const link = await member.post(
      `/v1/me/privacy/exports/${overview.body.exports[0].id as string}/download-url`,
    );
    const archive = unzipSync(new Uint8Array(await (await fetch(link.body.url)).arrayBuffer()));
    const identity = Object.keys(archive).find((name) => name.startsWith('identity'));
    expect(strFromU8(archive[identity!]!)).toContain(member.email);

    const erasure = await member.post('/v1/me/privacy/erasure', { confirm: true });
    expect(erasure.status, JSON.stringify(erasure.body)).toBe(201);
    // The grace period (30 days) is shortened; the worker runs it on its next pass.
    await query('UPDATE privacy.erasures SET scheduled_for = now() WHERE id = $1', [
      erasure.body.id,
    ]);
    await eventually(
      () =>
        query<{ status: string }>('SELECT status FROM privacy.erasures WHERE id = $1', [
          erasure.body.id,
        ]),
      ([row]) => row?.status === 'completed',
      60_000,
    );
    const again = await new Browser().post('/v1/auth/sign-in/email', {
      email: member.email,
      password: 'end-to-end password 2026',
    });
    expect(again.status).toBe(401);
  });
});

describe('event and mission', () => {
  it('fills an event and runs a volunteer mission to its acceptance', async () => {
    const organizer = await demo('aissatou-ba');
    const startsAt = Date.now() + 7 * 24 * 3_600_000;
    const event = await organizer.post('/v1/events', {
      title: 'Atelier séchage solaire',
      description: 'Démonstration des séchoirs et échanges avec les coopératives.',
      format: 'online',
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(startsAt + 2 * 3_600_000).toISOString(),
      timeZone: 'Africa/Dakar',
      location: null,
      onlineUrl: 'https://meet.example.org/sechage',
      language: 'fr',
      sectorCodes: ['agriculture_forestry_fishing'],
      capacity: 20,
      visibility: 'members',
    });
    expect(event.status, JSON.stringify(event.body)).toBe(201);
    expect((await organizer.post(`/v1/events/${event.body.id as string}/publish`)).status).toBe(
      200,
    );
    const attendee = await demo('kofi-mensah');
    const seat = await attendee.call('PUT', `/v1/events/${event.body.id as string}/registration`, {
      showInAttendees: true,
    });
    expect(seat.body).toMatchObject({ status: 'registered' });
    const asAttendee = await attendee.get(`/v1/events/${event.body.id as string}`);
    expect(asAttendee.body.onlineUrl).toBe('https://meet.example.org/sechage');

    const offer = await attendee.post('/v1/missions/offers', {
      title: 'Revue du plan de séchage',
      description: 'Deux sessions pour dimensionner les séchoirs.',
      // Kofi wears the mentor hat (demonstration data).
      kind: 'mentoring',
      domain: 'Énergie',
      sectorCodes: ['agriculture_forestry_fishing'],
      format: 'session',
      estimatedHours: 4,
      mode: 'remote',
      languages: ['fr'],
      capacity: 1,
    });
    expect(offer.status, JSON.stringify(offer.body)).toBe(201);
    const engagement = await organizer.post(`/v1/missions/${offer.body.id as string}/engagements`, {
      message: 'Votre aide sur nos séchoirs ?',
    });
    expect(engagement.status, JSON.stringify(engagement.body)).toBe(201);
    const answered = await attendee.post(
      `/v1/mission-engagements/${engagement.body.id as string}/accept`,
      { message: 'Avec plaisir.' },
    );
    expect(answered.status, JSON.stringify(answered.body)).toBe(200);
    expect(answered.body.status).toBe('accepted');
  });
});
