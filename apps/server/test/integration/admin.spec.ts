import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { AuditEntry, FailedJob, Post } from '@pitchorium/contracts';
import { Queue } from 'bullmq';
import { v7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { createFullWorker } from './support/full-worker';
import { createMember, grantRoleWith2fa, type Member } from './support/members';
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
    expect(file.body).toMatchObject({ userId: amina.userId, suspension: null, kycVerified: false });
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
      expect.objectContaining({ targetType: 'post', targetId: post.id }),
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

  it('gives the statistics of the platform', async () => {
    const stats = await admin.agent.get('/v1/admin/stats').expect(200);
    expect(stats.body).toMatchObject({
      members: { total: 3 },
      contributions: { succeeded: 0, collectedEurMinor: '0' },
      pending: { moderationCases: 0, rightsRequests: 0 },
    });
  });
});
