import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { Notification, NotificationPreferences } from '@pitchorium/contracts';
import request from 'supertest';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentModule } from '../../src/modules/content';
import { DiscoveryModule } from '../../src/modules/discovery';
import { EngagementModule } from '../../src/modules/engagement';
import { EventsModule } from '../../src/modules/events';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { MessagingModule } from '../../src/modules/messaging';
import { MissionsModule } from '../../src/modules/missions';
import { NetworkModule } from '../../src/modules/network';
import { NotificationsFacade, NotificationsModule } from '../../src/modules/notifications';
import { NotificationEmailsService } from '../../src/modules/notifications/application/notification-emails.service';
import { NotificationsMaintenanceService } from '../../src/modules/notifications/application/notifications-maintenance.service';
import { NOTIFICATIONS_QUEUE } from '../../src/modules/notifications/interface/notifications-queue';
import { svixSignature } from '../../src/modules/notifications/infrastructure/svix-signature';
import { OrganizationsModule } from '../../src/modules/organizations';
import { PaymentsModule } from '../../src/modules/payments';
import { ProfilesModule } from '../../src/modules/profiles';
import { ProjectsModule } from '../../src/modules/projects';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { Clock } from '../../src/platform/kernel';
import { MailerModule } from '../../src/platform/mailer';
import { ObservabilityModule } from '../../src/platform/observability';
import { OutboxRelayService } from '../../src/platform/outbox';
import { QUEUE_NAMES } from '../../src/platform/queue';
import { RealtimePublisherModule } from '../../src/platform/realtime';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { Mailpit } from './support/mailpit';
import { createMember, type Member } from './support/members';
import { connectMembers, device, handleOf, write } from './support/messaging';
import { entrepreneur, publishedProject } from './support/payments';
import { createWorkerTestingModule } from './support/worker-testing-module';

/** Real time moved by an offset: the worker sees the events of the api, and tests go forward. */
class ShiftedClock extends Clock {
  private offsetMs = 0;

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /** From now on, the clock reads this instant and runs from it. */
  set(at: Date): void {
    this.offsetMs = at.getTime() - Date.now();
  }
}

const RESEND_SECRET = `whsec_${Buffer.from('resend-webhook-secret-for-tests').toString('base64')}`;

/** Headers of the last email to an address whose subject contains a text (Mailpit API). */
async function headersOf(address: string, subject: string): Promise<Record<string, string[]>> {
  const base = inject('mailpitApiUrl');
  const search = (await (
    await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`)
  ).json()) as { messages: { ID: string; Subject: string }[] };
  const found = search.messages.find((message) => message.Subject.includes(subject));
  if (!found) throw new Error(`No email "${subject}" to ${address}`);
  return (await (await fetch(`${base}/api/v1/message/${found.ID}/headers`)).json()) as Record<
    string,
    string[]
  >;
}

/** Notifications (§10.5): every family of events, grouping, fan-out, digests, emails. */
describe('notifications', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let baseUrl: string;
  const clock = new ShiftedClock();
  const mailpit = new Mailpit();
  const sockets: { disconnect(): void }[] = [];
  let ama: Member;
  let kofi: Member;
  let awa: Member;

  const deliver = () => worker.get(OutboxRelayService).relayBatch();
  const notificationsOf = async (member: Member) =>
    ((await member.agent.get('/v1/me/notifications').expect(200)).body as { items: Notification[] })
      .items;
  /** Digests received by an address (sign-up emails left aside). */
  const digestsTo = async (address: string) =>
    (await mailpit.messagesTo(address)).filter((message) => /résumé|summary/.test(message.Subject));
  /** Relays the outbox until an email reaches the address. */
  const emailTo = (address: string, subject: string) =>
    vi.waitFor(
      async () => {
        await deliver();
        const found = (await mailpit.messagesTo(address)).filter((m) =>
          m.Subject.includes(subject),
        );
        expect(found.length).toBeGreaterThan(0);
      },
      { timeout: 30_000, interval: 300 },
    );
  /** Relays the outbox until the member has a notification of the type. */
  const waitFor = (member: Member, type: string) =>
    vi.waitFor(
      async () => {
        await deliver();
        const found = (await notificationsOf(member)).find((n) => n.type === type);
        expect(found, `${member.email} ${type}`).toBeDefined();
        return found!;
      },
      { timeout: 30_000, interval: 200 },
    );

  beforeAll(async () => {
    const env = {
      RESEND_WEBHOOK_SECRET: RESEND_SECRET,
      NOTIFICATIONS_FANOUT_BATCH_SIZE: '1000',
      NOTIFICATIONS_LOW_PRIORITY_PER_DAY: '2',
    };
    ({ app } = await createApiTestApp([], env));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    worker = await createWorkerTestingModule(
      [],
      [
        ObservabilityModule,
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        RealtimePublisherModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
        ContentModule.forWorker(),
        ImpactModule.forWorker(),
        ProjectsModule.forWorker(),
        PaymentsModule.forWorker(),
        EngagementModule.forWorker(),
        MessagingModule.forWorker(),
        EventsModule.forWorker(),
        MissionsModule.forWorker(),
        DiscoveryModule.forWorker(),
        NotificationsModule.forWorker(),
      ],
      (builder) => builder.overrideProvider(Clock).useValue(clock),
      env,
    );
  });

  /** The jobs left by a test finish before the next one truncates the tables. */
  afterEach(async () => {
    const queues = [QUEUE_NAMES.domainEvents, NOTIFICATIONS_QUEUE].map((name) =>
      worker.get<Queue>(getQueueToken(name), { strict: false }),
    );
    await vi.waitFor(
      async () => {
        for (const queue of queues) {
          const counts = await queue.getJobCounts('active', 'waiting', 'prioritized');
          expect(counts['active'] ?? 0).toBe(0);
          expect((counts['waiting'] ?? 0) + (counts['prioritized'] ?? 0)).toBe(0);
        }
      },
      { timeout: 120_000, interval: 200 },
    );
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    clock.set(new Date());
    await truncateAllTables();
    await mailpit.clear();
    ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    for (const member of [ama, kofi, awa]) await handleOf(member);
  });

  it('notifies every family of events, groups reactions and pushes notifications and counters', async () => {
    const amaDevice = await device(baseUrl, ama);
    sockets.push(amaDevice.socket);

    // Network: a connection request, then its acceptance.
    await connectMembers(kofi, ama);
    await waitFor(ama, 'connection_request');
    expect(await waitFor(kofi, 'connection_accepted')).toMatchObject({
      actors: [{ handle: await handleOf(ama) }],
    });

    // Content: two reactions on one publication make one notification; a comment emails.
    const post = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Notre coopérative recrute.', visibility: 'members' })
      .expect(201);
    await kofi.agent.put(`/v1/posts/${post.body.id}/reaction`).send({ type: 'bravo' }).expect(200);
    await awa.agent.put(`/v1/posts/${post.body.id}/reaction`).send({ type: 'support' }).expect(200);
    const reactions = await vi.waitFor(
      async () => {
        await deliver();
        const found = (await notificationsOf(ama)).filter((n) => n.type === 'reaction');
        expect(found[0]?.actorCount).toBe(2);
        return found;
      },
      { timeout: 30_000, interval: 200 },
    );
    expect(reactions).toHaveLength(1);
    expect(reactions[0]).toMatchObject({
      eventCount: 2,
      // Events are processed in any order: both actors, the latest first.
      actors: expect.arrayContaining([
        expect.objectContaining({ handle: await handleOf(awa) }),
        expect.objectContaining({ handle: await handleOf(kofi) }),
      ]),
      target: { type: 'post', key: post.body.id, path: `/posts/${post.body.id}` },
    });
    await kofi.agent
      .post(`/v1/posts/${post.body.id}/comments`)
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Bravo !' })
      .expect(201);
    await waitFor(ama, 'comment');
    await emailTo(ama.email, 'Kofi Mensah a commenté votre publication');
    const email = await mailpit.waitFor(ama.email, 'Kofi Mensah a commenté votre publication');
    expect(email.text).toContain(`/posts/${post.body.id}`);

    // Messaging: a message between connected members.
    await write(kofi, await handleOf(ama), 'Bonjour Ama');
    await waitFor(ama, 'message');

    // Projects (A4): an invitation into a team, emailed; payments: an off-platform contribution.
    const fatou = await entrepreneur(app, 'fatou@example.com', 'Fatou Sall');
    const project = await publishedProject(fatou);
    await fatou.agent
      .post(`/v1/projects/${project.id}/team/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({ handle: await handleOf(kofi), role: 'editor' })
      .expect(204);
    expect(await waitFor(kofi, 'project_team_invitation')).toMatchObject({
      data: { title: project.title, role: 'editor' },
      target: { type: 'project_invitations' },
    });
    await emailTo(kofi.email, `vous invite dans l'équipe de ${project.title}`);
    await awa.agent
      .post(`/v1/projects/${project.id}/offline-contributions`)
      .set('Idempotency-Key', randomUUID())
      .send({ kind: 'love_money_commitment', description: 'Je soutiens Fatou.' })
      .expect(201);
    await waitFor(fatou, 'offline_contribution_declared');

    // Organizations: an invitation to an existing account; engagement: shared time.
    const organization = await kofi.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Fondation Teranga', structureType: 'foundation', countryCodes: ['SN'] })
      .expect(201);
    await kofi.agent
      .post(`/v1/organizations/${organization.body.id}/invitations`)
      .set('Idempotency-Key', randomUUID())
      .send({ email: awa.email, role: 'member' })
      .expect(201);
    await waitFor(awa, 'organization_invitation');
    await awa.agent
      .post('/v1/me/time-entries')
      .set('Idempotency-Key', randomUUID())
      .send({
        entrepreneurHandle: await handleOf(fatou),
        kind: 'mentoring',
        minutes: 60,
        date: new Date().toISOString().slice(0, 10),
        description: 'Revue du plan de financement',
      })
      .expect(201);
    await waitFor(fatou, 'time_entry_declared');

    // Profile views of the previous day: private visitors counted, never named.
    const yesterday = new Date(clock.now().getTime() - 86_400_000).toISOString().slice(0, 10);
    await query(
      `INSERT INTO network.profile_views (viewed_id, day, viewer_id, viewed_at, private)
       VALUES ($1, $3, $2, now(), false), ($1, $3, $4, now(), true)`,
      [ama.userId, kofi.userId, yesterday, awa.userId],
    );
    await worker.get(NotificationsMaintenanceService).profileViews();
    expect(await waitFor(ama, 'profile_views')).toMatchObject({
      actorCount: 2,
      actors: [{ handle: await handleOf(kofi) }],
      data: { count: 2 },
    });

    // Pushed in real time, with the unified counters.
    expect(amaDevice.received.get('notifications:notification')?.length).toBeGreaterThan(0);
    const counters = (await ama.agent.get('/v1/me/counters').expect(200)).body;
    expect(counters).toMatchObject({ messages: { unread: 1, conversations: 1 } });
    expect(amaDevice.received.get('counters')?.at(-1)).toEqual({ counters });

    // Read one, read all, delete.
    const [first] = await notificationsOf(ama);
    await ama.agent.post(`/v1/me/notifications/${first!.id}/read`).expect(204);
    await ama.agent.post('/v1/me/notifications/read-all').expect(200);
    expect((await ama.agent.get('/v1/me/counters')).body.notifications).toBe(0);
    await ama.agent.delete(`/v1/me/notifications/${first!.id}`).expect(204);
    await kofi.agent.delete(`/v1/me/notifications/${first!.id}`).expect(404);
  });

  it('fans a publication out to 5 000 followers by batches, once each, under the daily cap', async () => {
    await query(
      `INSERT INTO network.follows (follower_id, target_type, target_id, origin, created_at)
       SELECT gen_random_uuid(), 'member', $1, 'manual', now() FROM generate_series(1, 5000)`,
      [ama.userId],
    );
    const publish = () =>
      ama.agent
        .post('/v1/posts')
        .set('Idempotency-Key', randomUUID())
        .send({ text: `Publication ${randomUUID()}`, visibility: 'members' })
        .expect(201);
    const post = await publish();
    const count = async () =>
      Number(
        (
          await query<{ count: string }>(
            `SELECT count(*) FROM notifications.notifications
             WHERE type = 'followed_post' AND target_id = $1`,
            [post.body.id],
          )
        )[0]?.count,
      );
    // Only the publication is relayed: the batches enqueue each other in the worker.
    await deliver();
    await vi.waitFor(async () => expect(await count()).toBe(5000), {
      timeout: 120_000,
      interval: 500,
    });
    // The pushes and counters of the 5 000 are left aside: they would only delay the next checks.
    await query(
      `DELETE FROM platform.outbox_events
       WHERE event_type = 'notifications.batch.created.v1' AND published_at IS NULL`,
    );
    // A replayed batch delivers nothing twice.
    const [source] = await query<{ source: string }>(
      `SELECT DISTINCT source FROM notifications.deliveries WHERE source LIKE '%:followed_post'`,
    );
    const maintenance = worker.get(NotificationsMaintenanceService);
    await maintenance.fanoutBatch({
      source: source!.source,
      fanout: {
        type: 'followed_post',
        followersOf: { targetType: 'member', targetId: ama.userId },
        actorId: ama.userId,
        target: { type: 'post', key: post.body.id },
      },
      afterFollowerId: null,
    });
    expect(await count()).toBe(5000);

    // Low priority: grouped while unread, and two new notifications a day at most.
    await query(`DELETE FROM network.follows`);
    await kofi.agent.put(`/v1/network/follows/member/${await handleOf(ama)}`).expect(200);
    const kofiPosts = async () =>
      (await notificationsOf(kofi)).filter((n) => n.type === 'followed_post');
    for (let round = 1; round <= 3; round += 1) {
      await publish();
      await vi.waitFor(
        async () => {
          await deliver();
          const posts = await kofiPosts();
          expect(posts.reduce((sum, n) => sum + n.eventCount, 0)).toBe(Math.min(round, 2));
        },
        { timeout: 30_000, interval: 200 },
      );
      await kofi.agent.post('/v1/me/notifications/read-all').expect(200);
    }
    expect(await kofiPosts()).toHaveLength(2);
  }, 240_000);

  it('sends the daily digest at 8 in the time zone of each member', async () => {
    await kofi.agent.put('/v1/me/preferences').send({ locale: 'fr', timeZone: 'Europe/Paris' });
    await awa.agent
      .put('/v1/me/preferences')
      .send({ locale: 'en', timeZone: 'America/Port-au-Prince' });
    for (const member of [kofi, awa]) {
      await member.agent
        .patch('/v1/me/notification-preferences')
        .send({ emailDigest: 'daily' })
        .expect(200);
    }
    // 2026-10-12 06:30 UTC: 08:30 in Paris, 02:30 in Port-au-Prince.
    clock.set(new Date('2026-10-12T06:30:00Z'));
    const facade = worker.get(NotificationsFacade);
    await facade.notify(`test-${randomUUID()}`, {
      type: 'comment',
      recipientIds: [kofi.userId, awa.userId],
      actorId: ama.userId,
      target: { type: 'post', key: randomUUID() },
    });
    const emails = worker.get(NotificationEmailsService);
    expect(await emails.digests()).toBe(1);
    await mailpit.waitFor(kofi.email, 'Votre résumé du jour : 1 notifications');
    expect(await digestsTo(awa.email)).toHaveLength(0);
    // 12:30 UTC: 08:30 in Port-au-Prince; Paris already had its digest today.
    clock.set(new Date('2026-10-12T12:30:00Z'));
    expect(await emails.digests()).toBe(1);
    await mailpit.waitFor(awa.email, 'Your daily summary: 1 notifications');
    expect(await digestsTo(kofi.email)).toHaveLength(1);
  });

  it('emails unread messages after the delay, grouped by conversation, then unsubscribes in one click', async () => {
    await connectMembers(ama, kofi);
    // The copy of unread messages is off until the member turns it on (§10.4).
    await kofi.agent
      .patch('/v1/me/notification-preferences')
      .send({ changes: [{ type: 'message', channel: 'email', enabled: true }] })
      .expect(200);
    await write(ama, await handleOf(kofi), 'Bonjour Kofi');
    await write(ama, await handleOf(kofi), 'Avez-vous vu notre dossier ?');
    await waitFor(kofi, 'message');
    const emails = worker.get(NotificationEmailsService);
    expect(await emails.unreadCopies()).toBe(0);
    clock.set(new Date(Date.now() + 31 * 60_000));
    await vi.waitFor(async () => {
      await deliver();
      const [row] = await query<{ last_sequence: number }>(
        'SELECT last_sequence FROM notifications.unread_message_emails',
      );
      expect(row?.last_sequence).toBe(2);
    });
    expect(await emails.unreadCopies()).toBe(1);
    const email = await mailpit.waitFor(kofi.email, '2 nouveaux messages de Ama Owusu');
    expect(email.text).toContain('Avez-vous vu notre dossier ?');

    // One-click unsubscribe: POST to the List-Unsubscribe URL, without session.
    const headers = await headersOf(kofi.email, 'nouveaux messages');
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click']);
    const url = new URL(/<([^>]+)>/.exec(headers['List-Unsubscribe']?.[0] ?? '')?.[1] ?? '');
    const unsubscribed = await request(app.getHttpServer())
      .post(`${url.pathname}${url.search}`)
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(200);
    expect(unsubscribed.body).toEqual({ scope: 'message' });
    const preferences = (await kofi.agent.get('/v1/me/notification-preferences'))
      .body as NotificationPreferences;
    expect(preferences.types.find((p) => p.type === 'message')?.channels.email).toBe(false);
    await request(app.getHttpServer())
      .post('/v1/notifications/unsubscribe?token=forged.token-value-x')
      .expect(400);
    // A transactional type cannot be turned off.
    const locked = await kofi.agent
      .patch('/v1/me/notification-preferences')
      .send({ changes: [{ type: 'kyc_decided', channel: 'email', enabled: false }] })
      .expect(422);
    expect(locked.body.code).toBe('NOTIFICATIONS_PREFERENCE_LOCKED');
  });

  it('suppresses an address after a signed bounce, then never writes to it again', async () => {
    const body = JSON.stringify({
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: { email_id: 'em_1', to: [kofi.email], bounce: { type: 'Permanent' } },
    });
    const post = (signature: string, id = 'msg_bounce_1') => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      return request(app.getHttpServer())
        .post('/v1/notifications/webhooks/resend')
        .set('content-type', 'application/json')
        .set('svix-id', id)
        .set('svix-timestamp', timestamp)
        .set(
          'svix-signature',
          signature || `v1,${svixSignature(RESEND_SECRET, id, timestamp, body)}`,
        )
        .send(body);
    };
    await post('v1,forged').expect(400);
    expect((await post('').expect(200)).body).toEqual({ received: true, outcome: 'accepted' });
    expect((await post('').expect(200)).body.outcome).toBe('duplicate');
    expect(await query('SELECT email, reason FROM notifications.suppressions')).toEqual([
      { email: kofi.email, reason: 'bounce' },
    ]);

    // A comment would email Kofi at once: nothing leaves for a suppressed address.
    await worker.get(NotificationsFacade).notify(`test-${randomUUID()}`, {
      type: 'comment',
      recipientIds: [kofi.userId, awa.userId],
      actorId: ama.userId,
      target: { type: 'post', key: randomUUID() },
    });
    await emailTo(awa.email, 'Ama Owusu a commenté votre publication');
    expect(
      (await mailpit.messagesTo(kofi.email)).filter((m) => m.Subject.includes('commenté')),
    ).toHaveLength(0);
  });

  it('emails a non-transactional event of another module with the preferences, the suppression list and RFC 8058', async () => {
    const organization = await kofi.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Fondation Teranga', structureType: 'foundation', countryCodes: ['SN'] })
      .expect(201);
    /** The arrival of a member, as the organizations module records it. */
    const joins = (member: Member) =>
      query(
        `INSERT INTO platform.outbox_events
           (id, aggregate_type, aggregate_id, event_type, payload, occurred_at, next_attempt_at)
         VALUES ($1, 'organization', $2, 'organizations.member.joined.v1', $3, now(), now())`,
        [
          randomUUID(),
          organization.body.id,
          JSON.stringify({ userId: member.userId, role: 'member', invitationId: randomUUID() }),
        ],
      );
    const joinedEmails = async (name: string) =>
      (await mailpit.messagesTo(kofi.email)).filter((m) => m.Subject.includes(`${name} a rejoint`));
    const freshNotification = async () => {
      await kofi.agent.post('/v1/me/notifications/read-all').expect(200);
    };

    // Emailed by the notifications module, with the one-click unsubscribe.
    await joins(awa);
    await emailTo(kofi.email, 'Awa Ndiaye a rejoint Fondation Teranga');
    const headers = await headersOf(kofi.email, 'Awa Ndiaye a rejoint');
    expect(headers['List-Unsubscribe']?.[0]).toContain('/v1/notifications/unsubscribe?token=');
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click']);

    // A suppressed address receives nothing; the notification stays in the app.
    await freshNotification();
    await query(
      `INSERT INTO notifications.suppressions (email, reason, created_at) VALUES ($1, 'bounce', now())`,
      [kofi.email],
    );
    await joins(ama);
    await vi.waitFor(
      async () => {
        await deliver();
        const unread = (await kofi.agent.get('/v1/me/notifications?unread=true').expect(200)).body;
        expect(unread.items).toHaveLength(1);
      },
      { timeout: 30_000, interval: 200 },
    );
    await query(`DELETE FROM notifications.suppressions`);

    // The member turned the email of the type off: in the app only.
    await kofi.agent
      .patch('/v1/me/notification-preferences')
      .send({ changes: [{ type: 'organization_member_joined', channel: 'email', enabled: false }] })
      .expect(200);
    await freshNotification();
    await joins(awa);
    await vi.waitFor(
      async () => {
        await deliver();
        const unread = (await kofi.agent.get('/v1/me/notifications?unread=true').expect(200)).body;
        expect(unread.items).toHaveLength(1);
      },
      { timeout: 30_000, interval: 200 },
    );
    await vi.waitFor(async () => {
      const counts = await worker
        .get<Queue>(getQueueToken(NOTIFICATIONS_QUEUE), { strict: false })
        .getJobCounts('active', 'waiting');
      expect((counts['active'] ?? 0) + (counts['waiting'] ?? 0)).toBe(0);
    });
    expect(await joinedEmails('Ama Owusu')).toEqual([]);
    expect(await joinedEmails('Awa Ndiaye')).toHaveLength(1);

    // The transactional emails of organizations are never doubled by a notification email.
    const locked = await kofi.agent
      .patch('/v1/me/notification-preferences')
      .send({ changes: [{ type: 'organization_role_changed', channel: 'email', enabled: true }] })
      .expect(422);
    expect(locked.body.code).toBe('NOTIFICATIONS_PREFERENCE_LOCKED');
  });

  it('purges the notifications past the retention', async () => {
    await worker.get(NotificationsFacade).notify(`test-${randomUUID()}`, {
      type: 'mention',
      recipientIds: [kofi.userId],
      actorId: ama.userId,
      target: { type: 'post', key: randomUUID() },
    });
    expect(await notificationsOf(kofi)).toHaveLength(1);
    clock.set(new Date(Date.now() + 91 * 86_400_000));
    expect(await worker.get(NotificationsMaintenanceService).purge()).toBeGreaterThanOrEqual(1);
    expect(await notificationsOf(kofi)).toHaveLength(0);
  });
});
