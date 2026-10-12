import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type {
  AuditEntry,
  ConsoleQueues,
  FailedJob,
  FeatureFlagView,
  MemberFile,
  Post,
} from '@pitchorium/contracts';
import { Queue } from 'bullmq';
import { v7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { createFullWorker } from './support/full-worker';
import { browser, createMember, grantRoleWith2fa, type Member, signIn } from './support/members';
import { handleOf } from './support/messaging';

/** Back office (ADR 0078): audited reads, guarded flags, highlights, failed jobs. */
describe('admin', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let admin: Member;
  let moderator: Member;
  let amina: Member;

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    // The worker truncates the tables when it starts.
    worker = await createFullWorker();
    admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    moderator = await createMember(app, 'moderator@example.com', { name: 'Modératrice' });
    amina = await createMember(app, 'amina@example.com', { name: 'Amina Diop' });
    for (const member of [admin, moderator, amina]) await handleOf(member);
    await grantRoleWith2fa(admin, 'admin');
    await grantRoleWith2fa(moderator, 'moderator');
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('audits the reading of a member and of the log, for administrators only', async () => {
    const found = await admin.agent.get('/v1/admin/members?q=amina').expect(200);
    expect(found.body.items).toEqual([
      expect.objectContaining({ userId: amina.userId, email: amina.email, roles: ['member'] }),
    ]);
    const file = await admin.agent.get(`/v1/admin/members/${amina.userId}`).expect(200);
    expect(file.body).toMatchObject({
      userId: amina.userId,
      suspension: null,
      kycVerified: false,
      decisions: [],
      contributions: [],
    });
    const sessions = (file.body as MemberFile).sessions;
    expect(sessions.length).toBeGreaterThan(0);
    expect(Object.keys(sessions[0]!).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'lastActiveAt',
      'userAgent',
    ]);
    await moderator.agent.get(`/v1/admin/members/${amina.userId}`).expect(403);

    const log = await admin.agent
      .get(`/v1/admin/audit-log?action=admin.member-viewed&targetId=${amina.userId}`)
      .expect(200);
    expect(log.body.items as AuditEntry[]).toEqual([
      expect.objectContaining({ actorId: admin.userId, targetType: 'user' }),
    ]);
    const reads = await admin.agent.get('/v1/admin/audit-log?action=admin.audit-read').expect(200);
    expect(reads.body.items).toHaveLength(1);
  });

  it('guards the flags: reviewed locales only, legal reference for equity', async () => {
    const flag = (key: string, body: object) =>
      admin.agent
        .patch(`/v1/admin/feature-flags/${key}`)
        .set('Idempotency-Key', randomUUID())
        .send(body);
    expect((await flag('locale.sw', { enabled: true }).expect(409)).body.code).toBe(
      'LOCALIZATION_LOCALE_NOT_READY',
    );
    expect((await flag('funding.equity', { enabled: true }).expect(422)).body.code).toBe(
      'ADMIN_LEGAL_REFERENCE_REQUIRED',
    );
    const enabled = await flag('funding.equity', {
      enabled: true,
      legalReference: 'Avis juridique de test, 2026-10-08',
    }).expect(200);
    expect(enabled.body).toMatchObject({
      key: 'funding.equity',
      enabled: true,
      legalReference: 'Avis juridique de test, 2026-10-08',
    });
    await flag('funding.equity', { enabled: false }).expect(200);
    await flag('unknown.flag', { enabled: true }).expect(404);
    const flags = (await admin.agent.get('/v1/admin/feature-flags').expect(200)).body.items as {
      key: string;
      enabled: boolean;
    }[];
    expect(flags.find((item) => item.key === 'locale.sw')).toMatchObject({ enabled: false });
    // The guardrails the console shows: the state of a locale, the legal reference.
    const views = flags as FeatureFlagView[];
    expect(views.find((item) => item.key === 'locale.sw')?.guard).toMatchObject({
      kind: 'locale',
      status: { locale: 'sw', activatable: false },
    });
    expect(views.find((item) => item.key === 'funding.equity')?.guard).toEqual({
      kind: 'legal',
      legalReferenceRequired: true,
      onlinePaymentAvailable: false,
    });
    const history = await admin.agent
      .get('/v1/admin/feature-flags/funding.equity/history')
      .expect(200);
    expect(history.body.items).toEqual([
      expect.objectContaining({
        enabled: false,
        changedBy: { userId: admin.userId, name: 'Admin' },
      }),
      expect.objectContaining({
        enabled: true,
        legalReference: 'Avis juridique de test, 2026-10-08',
      }),
    ]);
  });

  it('features publications, projects and profiles through one interface', async () => {
    const post = (
      await amina.agent
        .post('/v1/posts')
        .set('Idempotency-Key', randomUUID())
        .send({ text: 'Appel à projets agriculture', visibility: 'members' })
        .expect(201)
    ).body as Post;
    const restricted = (
      await amina.agent
        .post('/v1/posts')
        .set('Idempotency-Key', randomUUID())
        .send({ text: 'Réservé', visibility: 'connections' })
        .expect(201)
    ).body as Post;
    await moderator.agent.put(`/v1/admin/highlights/post/${post.id}`).expect(204);
    await amina.agent.put(`/v1/admin/highlights/post/${post.id}`).expect(403);
    expect(
      (await moderator.agent.put(`/v1/admin/highlights/post/${restricted.id}`).expect(422)).body
        .code,
    ).toBe('CONTENT_VISIBILITY_NOT_ALLOWED');
    // A profile without its public page is not featured.
    expect(
      (
        await moderator.agent
          .put(`/v1/admin/highlights/profile/${await handleOf(amina)}`)
          .expect(404)
      ).body.code,
    ).toBe('ADMIN_HIGHLIGHT_TARGET_NOT_FOUND');
    const listed = await moderator.agent.get('/v1/admin/highlights').expect(200);
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        targetType: 'post',
        targetId: post.id,
        label: 'Appel à projets agriculture',
        position: 1,
      }),
    ]);
    await moderator.agent.delete(`/v1/admin/highlights/post/${post.id}`).expect(204);
    expect(
      (await moderator.agent.get('/v1/admin/highlights?targetType=post').expect(200)).body.items,
    ).toEqual([]);
  });

  it('lists a job failed for good and retries it once, idempotently', async () => {
    const queue = new Queue('trust.moderation', {
      connection: { url: process.env['REDIS_URL'] ?? '', maxRetriesPerRequest: null },
      prefix: process.env['QUEUE_PREFIX'] ?? 'pitchorium',
    });
    try {
      const job = await queue.add(
        'refund',
        { contributionId: v7(), reason: 'test' },
        { attempts: 1, jobId: `refund-test-${randomUUID()}` },
      );
      const failed = await vi.waitFor(
        async () => {
          const response = await admin.agent
            .get('/v1/admin/jobs/failed?queue=trust.moderation')
            .expect(200);
          const item = (response.body.items as FailedJob[]).find((entry) => entry.id === job.id);
          expect(item).toBeDefined();
          return item!;
        },
        { timeout: 30_000, interval: 300 },
      );
      expect(failed).toMatchObject({ name: 'refund', attemptsMade: 1 });
      // The payload as the console reads it: the identifier, never the free text.
      expect(failed.data).toEqual({
        contributionId: expect.any(String),
        reason: '[redacted]',
      });
      const key = randomUUID();
      const retry = () =>
        admin.agent
          .post(`/v1/admin/jobs/trust.moderation/${job.id}/retry`)
          .set('Idempotency-Key', key);
      expect((await retry().expect(200)).body).toEqual({
        queue: 'trust.moderation',
        id: job.id,
        outcome: 'retried',
      });
      const replayed = await retry().expect(200);
      expect(replayed.headers['idempotent-replayed']).toBe('true');
      await admin.agent
        .post('/v1/admin/jobs/unknown.queue/1/retry')
        .set('Idempotency-Key', randomUUID())
        .expect(404);
      const log = await admin.agent.get('/v1/admin/audit-log?action=admin.job-retried').expect(200);
      expect(log.body.items).toHaveLength(1);
    } finally {
      await queue.close();
    }
  });

  it('gives each reader the queues their rights open, revokes sessions and exports the log', async () => {
    const queuesOf = async (member: Member) =>
      ((await member.agent.get('/v1/admin/queues').expect(200)).body as ConsoleQueues).items.map(
        (item) => item.queue,
      );
    expect(await queuesOf(moderator)).toEqual([
      'moderation_cases',
      'appeals',
      'organization_verifications',
    ]);
    expect(await queuesOf(admin)).toEqual([
      'moderation_cases',
      'appeals',
      'organization_verifications',
      'kyc_reviews',
      'offline_contributions',
      'discrepancies',
      'failed_jobs',
      'rights_requests',
    ]);
    await amina.agent.get('/v1/admin/queues').expect(403);

    const laptop = browser(app);
    await signIn(laptop, amina.email);
    await laptop.get('/v1/me').expect(200);
    await moderator.agent
      .post(`/v1/admin/members/${amina.userId}/sessions/revocation`)
      .set('Idempotency-Key', randomUUID())
      .expect(403);
    await admin.agent
      .post(`/v1/admin/members/${amina.userId}/sessions/revocation`)
      .set('Idempotency-Key', randomUUID())
      .expect(204);
    await laptop.get('/v1/me').expect(401);

    const exported = await admin.agent
      .get('/v1/admin/audit-log/export?action=admin.sessions-revoked')
      .expect(200);
    expect(exported.headers['content-type']).toBe('text/csv; charset=utf-8');
    const lines = exported.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'occurred_at,actor_type,actor_id,action,target_type,target_id,request_id,metadata,id',
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`admin.sessions-revoked,user,${amina.userId}`);
    await moderator.agent.get('/v1/admin/audit-log/export').expect(403);
    const audited = await admin.agent
      .get('/v1/admin/audit-log?action=admin.audit-exported')
      .expect(200);
    expect(audited.body.items).toHaveLength(1);
  });

  it('gives the statistics of the platform', async () => {
    const stats = await admin.agent.get('/v1/admin/stats').expect(200);
    expect(stats.body).toMatchObject({
      members: { total: 3 },
      contributions: { succeeded: 0, collectedEurMinor: '0' },
      pending: {
        moderationCases: 0,
        rightsRequests: 0,
        organizationVerifications: 0,
        discrepancies: 0,
      },
    });
  });
});
