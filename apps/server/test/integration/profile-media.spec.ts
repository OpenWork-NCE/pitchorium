import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { IdentityModule } from '../../src/modules/identity';
import { MediaModule } from '../../src/modules/media';
import { MalwareScanner } from '../../src/modules/media/application/ports';
import { ProfilesModule } from '../../src/modules/profiles';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { OutboxRelayService } from '../../src/platform/outbox';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_WEB_APP_URL } from './support/environment';
import { FakeMalwareScanner } from './support/fake-malware-scanner';
import { png } from './support/files';
import { uploadFile, waitUntilProcessed } from './support/media';
import { browser, createMember } from './support/members';
import { FakeOAuthProviders } from './support/oauth-providers';
import { createWorkerTestingModule } from './support/worker-testing-module';

const GOOGLE_PHOTO = 'https://lh3.googleusercontent.com/a/photo-of-amina';

/** Profile photo and cover through the media module, and import of the provider photo. */
describe('profile media', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  const providers = new FakeOAuthProviders();
  let fetchBeforePhotos: typeof fetch;
  let providerPhoto: Buffer;
  const deliver = () => worker.get(OutboxRelayService).relayBatch();

  beforeAll(async () => {
    await providers.start();
    providerPhoto = await png(500, 500);
    // The Google photo host answers from the test; any other host goes to the real network.
    fetchBeforePhotos = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.startsWith(GOOGLE_PHOTO)) {
        return Promise.resolve(
          new Response(new Uint8Array(providerPhoto), { headers: { 'content-type': 'image/png' } }),
        );
      }
      return fetchBeforePhotos(input, init);
    };
    ({ app } = await createApiTestApp([], {}, { storage: 'minio' }));
    worker = await createWorkerTestingModule(
      [],
      [
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
      ],
      (builder) => builder.overrideProvider(MalwareScanner).useValue(new FakeMalwareScanner()),
    );
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
    globalThis.fetch = fetchBeforePhotos;
    await providers.stop();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  it('shows an uploaded photo and cover on the profile, and replaces them', async () => {
    const member = await createMember(app, 'amina@example.com', { name: 'Amina Diop' });
    const photo = await uploadFile(member.agent, await png(600, 600), 'avatar', 'image/png');
    const cover = await uploadFile(
      member.agent,
      await png(1600, 400),
      'profile_cover',
      'image/png',
    );
    await waitUntilProcessed(member.agent, photo, deliver);
    await waitUntilProcessed(member.agent, cover, deliver);

    // Without a public page, photo and cover stay private files with presigned URLs.
    await member.agent.put('/v1/me/profile/avatar').send({ mediaId: photo }).expect(200);
    const own = await member.agent.put('/v1/me/profile/cover').send({ mediaId: cover }).expect(200);
    expect(own.body).toMatchObject({ avatarMediaId: photo, coverMediaId: cover });
    for (const url of [own.body.avatarUrl, own.body.coverUrl] as string[]) {
      expect(url).toContain('X-Amz-Signature=');
      expect((await fetch(url)).status).toBe(200);
    }

    // The public page makes them public files, moved by the worker to the public bucket.
    await member.agent.patch('/v1/me/profile/visibility').send({ publicPageEnabled: true });
    const page = await vi.waitFor(
      async () => {
        await deliver();
        const response = await browser(app).get('/v1/public/profiles/amina-diop').expect(200);
        expect(response.body.avatarUrl).not.toContain('X-Amz-Signature=');
        return response.body as { avatarUrl: string; coverUrl: string };
      },
      { timeout: 20_000, interval: 200 },
    );
    const publicPhoto = await fetch(page.avatarUrl);
    expect(publicPhoto.status).toBe(200);
    expect(publicPhoto.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await fetch(own.body.avatarUrl as string)).status).toBe(404);

    // A cover is not a photo, and a file can be attached only once.
    const wrongUsage = await member.agent
      .put('/v1/me/profile/avatar')
      .send({ mediaId: cover })
      .expect(422);
    expect(wrongUsage.body.code).toBe('MEDIA_USAGE_MISMATCH');
    const second = await uploadFile(member.agent, await png(600, 600), 'avatar', 'image/png');
    await waitUntilProcessed(member.agent, second, deliver);
    await member.agent.put('/v1/me/profile/avatar').send({ mediaId: second }).expect(200);
    expect((await member.agent.get(`/v1/media/${photo}`).expect(200)).body.attached).toBe(false);
    await member.agent.delete(`/v1/media/${second}`).expect(409);

    const removed = await member.agent.delete('/v1/me/profile/avatar').expect(200);
    expect(removed.body).toMatchObject({ avatarMediaId: null, avatarUrl: null });
  });

  it('imports the provider photo through the media pipeline', async () => {
    const agent = browser(app);
    await signUpWithGoogle(agent, 'photo@example.com', GOOGLE_PHOTO);
    expect((await agent.get('/v1/me/profile').expect(200)).body.avatarUrl).toBe(GOOGLE_PHOTO);

    const imported = await vi.waitFor(
      async () => {
        await deliver();
        const profile = (await agent.get('/v1/me/profile').expect(200)).body as {
          avatarMediaId: string | null;
          avatarUrl: string;
        };
        if (!profile.avatarMediaId) throw new Error('Photo not imported yet');
        return profile;
      },
      { timeout: 60_000, interval: 250 },
    );
    expect(imported.avatarUrl).not.toBe(GOOGLE_PHOTO);
    const media = (await agent.get(`/v1/media/${imported.avatarMediaId}`).expect(200)).body;
    expect(media).toMatchObject({ status: 'ready', usage: 'avatar', width: 500, attached: true });
  });

  it('refuses a provider photo outside the closed list of hosts and keeps the URL shown', async () => {
    const agent = browser(app);
    const foreign = 'https://photos.attacker.example/internal-probe.png';
    await signUpWithGoogle(agent, 'foreign@example.com', foreign);

    const rejected = await vi.waitFor(
      async () => {
        await deliver();
        const [row] = await query<{ status: string; rejection_reason: string | null }>(
          'SELECT status, rejection_reason FROM media.assets WHERE import_url = $1',
          [foreign],
        );
        if (row?.status !== 'rejected') throw new Error('Import not settled yet');
        return row;
      },
      { timeout: 60_000, interval: 250 },
    );
    expect(rejected.rejection_reason).toBe('import_failed');
    const profile = (await agent.get('/v1/me/profile').expect(200)).body;
    expect(profile).toMatchObject({ avatarMediaId: null, avatarUrl: foreign });
  });

  async function signUpWithGoogle(
    agent: ReturnType<typeof browser>,
    email: string,
    picture: string,
  ): Promise<void> {
    const started = await agent
      .post('/v1/auth/sign-in/social')
      .send({ provider: 'google', callbackURL: `${TEST_WEB_APP_URL}/home` })
      .expect(200);
    const state = new URL(started.body.url as string).searchParams.get('state');
    const code = providers.issueCode('google', {
      subject: `google-${email}`,
      email,
      emailVerified: true,
      name: 'Photo Member',
      picture,
    });
    await agent.get('/v1/auth/callback/google').query({ code, state }).expect(302);
    await agent
      .post('/v1/me/legal-acceptances')
      .set('Idempotency-Key', `legal-${email}`)
      .send({
        termsVersion: 'test-2026-10',
        privacyVersion: 'test-2026-10',
        adultDeclaration: true,
      })
      .expect(201);
  }
});
