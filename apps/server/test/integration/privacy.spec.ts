import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { PrivacyOverview, RightsRequest } from '@pitchorium/contracts';
import { createDatabase, type DatabaseHandle } from '@pitchorium/db';
import { strFromU8, unzipSync } from 'fflate';
import { v7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  seedDevData,
} from '../../scripts/dev-seed/seed-dev-data';
import { seedDevDiscovery } from '../../scripts/dev-seed/seed-dev-discovery';
import { seedDevMessaging } from '../../scripts/dev-seed/seed-dev-messaging';
import { createSeedContext, seedDevProjects } from '../../scripts/dev-seed/seed-dev-projects';
import { ErasureExecutorService } from '../../src/modules/privacy';
import { parseWorkerConfig } from '../../src/platform/config';
import { FixedClock, SystemClock } from '../../src/platform/kernel';
import { S3ObjectStorage } from '../../src/platform/storage/s3-object-storage';
import { createApiTestApp } from './support/api-app';
import { query } from './support/database';
import { TEST_LEGAL_VERSION } from './support/environment';
import { createFullWorker, notificationOf, relayAll } from './support/full-worker';
import { Mailpit } from './support/mailpit';
import { browser, createMember, grantRoleWith2fa, type Member, signIn } from './support/members';

const demoEmail = (handle: string) => `${handle.replaceAll('-', '.')}@${DEMO_EMAIL_DOMAIN}`;

/** GDPR rights (ADR 0074 and 0075) on the members of the demonstration data. */
describe('privacy', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let handle: DatabaseHandle;
  let storage: S3ObjectStorage;
  const mailpit = new Mailpit();

  async function demo(member: string): Promise<Member> {
    const agent = browser(app);
    const email = demoEmail(member);
    await signIn(agent, email, DEMO_PASSWORD);
    const [user] = await query<{ id: string }>('SELECT id FROM identity.users WHERE email = $1', [
      email,
    ]);
    return { agent, email, userId: user!.id };
  }
  const requestErasure = (member: Member) =>
    member.agent
      .post('/v1/me/privacy/erasure')
      .set('Idempotency-Key', randomUUID())
      .send({ confirm: true });

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], {}, { storage: 'minio' }));
    // The worker module truncates the tables when it starts: it comes before the seeding.
    worker = await createFullWorker();
    await mailpit.clear();
    handle = createDatabase({ url: inject('databaseUrl'), maxConnections: 2 });
    storage = new S3ObjectStorage(parseWorkerConfig(process.env).storage, new SystemClock());
    await seedDevData({
      db: handle.db,
      storage,
      legal: { termsVersion: TEST_LEGAL_VERSION, privacyVersion: TEST_LEGAL_VERSION },
    });
    const clock = new FixedClock(new Date());
    const context = await createSeedContext(clock);
    try {
      await seedDevProjects(context, clock);
      await seedDevMessaging(context, clock);
      await seedDevDiscovery(context, clock);
    } finally {
      await context.close();
    }
    await relayAll(worker);
  }, 240_000);

  afterAll(async () => {
    storage?.close();
    await handle?.pool.end();
    await worker?.close();
    await app?.close();
  });

  it('exports a rich member: one documented JSON per module and the files', async () => {
    const kofi = await demo('kofi-mensah');
    // A stored document of the member, as the media worker leaves it.
    const mediaId = v7();
    const key = `media/${mediaId}/document.pdf`;
    await storage.putObject({
      visibility: 'private',
      key,
      body: Buffer.from('%PDF-1.4 export test'),
      contentType: 'application/pdf',
    });
    await query(
      `INSERT INTO media.assets (id, owner_id, usage, source, status, visibility,
         declared_content_type, declared_size, content_type, size, page_count, quarantine_key,
         moderation_status, files, unattached_since, created_at, updated_at, processed_at)
       VALUES ($1, $2, 'post_document', 'upload', 'ready', 'private', 'application/pdf', 20,
         'application/pdf', 20, 1, $3, 'none', $4::jsonb, now(), now(), now(), now())`,
      [
        mediaId,
        kofi.userId,
        `quarantine/${mediaId}`,
        JSON.stringify({ fileKey: key, variants: {} }),
      ],
    );

    const requested = await kofi.agent
      .post('/v1/me/privacy/exports')
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    expect(
      (
        await kofi.agent
          .post('/v1/me/privacy/exports')
          .set('Idempotency-Key', randomUUID())
          .expect(429)
      ).body.code,
    ).toBe('PRIVACY_EXPORT_RATE_LIMITED');
    await vi.waitFor(
      async () => {
        await relayAll(worker);
        const overview = (await kofi.agent.get('/v1/me/privacy').expect(200))
          .body as PrivacyOverview;
        expect(overview.exports[0]).toMatchObject({ id: requested.body.id, status: 'ready' });
      },
      { timeout: 60_000, interval: 500 },
    );
    expect(await notificationOf(worker, kofi, 'export_ready')).toBeDefined();
    const link = await kofi.agent
      .post(`/v1/me/privacy/exports/${requested.body.id as string}/download-url`)
      .expect(200);
    const archive = unzipSync(
      new Uint8Array(await (await fetch(link.body.url as string)).arrayBuffer()),
    );
    const names = Object.keys(archive);
    for (const module of [
      'identity',
      'profiles',
      'network',
      'content',
      'messaging',
      'payments',
      'engagement',
      'events',
      'notifications',
      'discovery',
      'trust',
      'privacy',
      'media',
    ]) {
      expect(names, module).toContain(`${module}.json`);
    }
    expect(names).toContain('README.txt');
    expect(names).toContain(`files/${mediaId}.pdf`);
    const identity = JSON.parse(strFromU8(archive['identity.json']!)) as {
      description: string;
      data: { account: { email: string }; signInMethods: Record<string, unknown>[] };
    };
    expect(identity.description).toMatch(/account/);
    expect(identity.data.account.email).toBe(kofi.email);
    // Never a password or a token.
    expect(strFromU8(archive['identity.json']!)).not.toMatch(/password|token|secret/i);
    const payments = JSON.parse(strFromU8(archive['payments.json']!)) as {
      data: { contributions: { amountMinor: string }[] };
    };
    expect(payments.data.contributions.length).toBeGreaterThan(0);
    expect(typeof payments.data.contributions[0]?.amountMinor).toBe('string');
  });

  it('refuses the erasure while a campaign collects or for the only owner of an organization', async () => {
    const samuel = await demo('samuel-okafor');
    expect((await requestErasure(samuel).expect(409)).body.code).toBe(
      'PRIVACY_CAMPAIGN_IN_PROGRESS',
    );
    const thierry = await demo('thierry-lacroix');
    expect((await requestErasure(thierry).expect(409)).body.code).toBe('PRIVACY_SOLE_OWNER');
  });

  it('erases a rich member after the grace period, then finds no residue', async () => {
    const kofi = await demo('kofi-mensah');
    const counts = async () =>
      (
        await query<{ contributions: string; messages: string }>(
          `SELECT (SELECT count(*) FROM payments.contributions) AS contributions,
                  (SELECT count(*) FROM messaging.messages) AS messages`,
        )
      )[0];
    const before = await counts();
    const scheduled = await requestErasure(kofi).expect(201);
    expect(scheduled.body).toMatchObject({ status: 'scheduled' });
    expect((await requestErasure(kofi).expect(409)).body.code).toBe('PRIVACY_ERASURE_PENDING');
    expect(await notificationOf(worker, kofi, 'erasure_scheduled')).toBeDefined();
    // Canceled during the grace period, then asked again.
    await kofi.agent
      .post('/v1/me/privacy/erasure/cancel')
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    const again = await requestErasure(kofi).expect(201);

    // The grace period is over.
    await query(
      `UPDATE privacy.erasures SET scheduled_for = now() - interval '1 minute' WHERE id = $1`,
      [again.body.id],
    );
    await worker.get(ErasureExecutorService).runDue();
    const [erasure] = await query<{
      status: string;
      residues: string[] | null;
      user_id: string | null;
      pseudonym: string | null;
    }>('SELECT status, residues, user_id, pseudonym FROM privacy.erasures WHERE id = $1', [
      again.body.id,
    ]);
    expect(erasure).toEqual({
      status: 'completed',
      residues: null,
      user_id: null,
      pseudonym: null,
    });

    await kofi.agent.get('/v1/me').expect(401);
    // The demonstration account of Kofi is in English.
    await mailpit.waitFor(kofi.email, 'Your Pitchorium account was deleted');
    // Financial records and conversations of others are kept, the member is no longer there.
    expect(await counts()).toEqual(before);
    const [left] = await query<{ count: string }>(
      `SELECT count(*) FROM payments.contributions WHERE contributor_id = $1`,
      [kofi.userId],
    );
    expect(Number(left?.count)).toBe(0);
  });

  it('keeps a closed project with contributions under the pseudonym, listed for the admins', async () => {
    const holder = await demo('jean-baptiste-kouassi');
    const [project] = await query<{ id: string }>(
      `SELECT id FROM projects.projects WHERE owner_id = $1 AND status = 'closed'`,
      [holder.userId],
    );
    const requested = await requestErasure(holder).expect(201);
    await query(`UPDATE privacy.erasures SET scheduled_for = now() WHERE id = $1`, [
      requested.body.id,
    ]);
    await worker.get(ErasureExecutorService).runDue();
    const [done] = await query<{ status: string; residues: string[] | null }>(
      'SELECT status, residues FROM privacy.erasures WHERE id = $1',
      [requested.body.id],
    );
    expect(done).toEqual({ status: 'completed', residues: null });
    const [kept] = await query<{ owner_id: string; deleted_at: Date | null }>(
      'SELECT owner_id, deleted_at FROM projects.projects WHERE id = $1',
      [project!.id],
    );
    expect(kept?.deleted_at).toBeNull();
    expect(kept?.owner_id).not.toBe(holder.userId);

    const admin = await createMember(app, 'privacy-admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    const requests = (await admin.agent.get('/v1/admin/privacy/requests').expect(200)).body
      .items as RightsRequest[];
    expect(requests.find((item) => item.id === requested.body.id)).toMatchObject({
      kind: 'erasure',
      status: 'completed',
      userId: null,
      overdue: false,
    });
    // The export of Kofi went with his account.
    expect(
      requests.filter((item) => item.kind === 'erasure' && item.status === 'completed'),
    ).toHaveLength(2);
  });
});
