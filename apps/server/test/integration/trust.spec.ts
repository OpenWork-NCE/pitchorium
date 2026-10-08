import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type {
  ModerationCase,
  ModerationCaseDetail,
  ModerationDecisionDetail,
  ModerationStanding,
  Post,
  Project,
} from '@pitchorium/contracts';
import request from 'supertest';
import { v7 } from 'uuid';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { createFullWorker, notificationOf, relayAll } from './support/full-worker';
import { Mailpit } from './support/mailpit';
import { createMember, grantRoleWith2fa, type Member, signIn, browser } from './support/members';
import { connectMembers, handleOf, write } from './support/messaging';
import { contribute, entrepreneur, eur, publishedProject } from './support/payments';

const STATEMENT = 'Publication insultante envers un autre membre, contraire aux conditions.';

/** Trust and safety (§13, ADR 0072 and 0073): from the report to the appeal. */
describe('trust', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let amina: Member;
  let kofi: Member;
  let moderator: Member;
  let reviewer: Member;
  let admin: Member;
  const mailpit = new Mailpit();

  const post = async (author: Member, text: string): Promise<Post> => {
    const response = await author.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text, visibility: 'members' });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body as Post;
  };
  const report = (member: Member, body: object) =>
    member.agent.post('/v1/reports').set('Idempotency-Key', randomUUID()).send(body);
  const queue = async (member: Member, query = '') =>
    (await member.agent.get(`/v1/admin/moderation/cases${query}`).expect(200)).body
      .items as ModerationCase[];
  const caseOf = async (targetId: string) => {
    const found = (await queue(moderator)).find((item) => item.targetId === targetId);
    expect(found, `case of ${targetId}`).toBeDefined();
    return found!;
  };
  const decide = (member: Member, caseId: string, body: object) =>
    member.agent
      .post(`/v1/admin/moderation/cases/${caseId}/decisions`)
      .set('Idempotency-Key', randomUUID())
      .send({ ground: 'terms', statement: STATEMENT, ...body });

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], { PAYMENTS_MODE: 'simulated' }));
    // Messages are pushed in real time: the server listens, as in the messaging tests.
    await app.listen(0, '127.0.0.1');
    worker = await createFullWorker({ PAYMENTS_MODE: 'simulated' });
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await mailpit.clear();
    amina = await createMember(app, 'amina@example.com', { name: 'Amina Diop' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    moderator = await createMember(app, 'moderator@example.com', { name: 'Modératrice' });
    reviewer = await createMember(app, 'reviewer@example.com', { name: 'Relecteur' });
    admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    for (const member of [amina, kofi, moderator, reviewer, admin]) await handleOf(member);
    await grantRoleWith2fa(moderator, 'moderator');
    await grantRoleWith2fa(reviewer, 'moderator');
    await grantRoleWith2fa(admin, 'admin');
  });

  it('acknowledges a notice without an account and a member report, one case per target', async () => {
    const target = await post(amina, 'Un contenu signalé.');
    const notice = await request(app.getHttpServer())
      .post('/v1/public/reports')
      .send({
        targetType: 'post',
        targetId: target.id,
        details: 'Ce contenu reproduit un document confidentiel volé.',
        reporterEmail: 'notifier@example.com',
        goodFaith: true,
      })
      .expect(201);
    expect(notice.body).toMatchObject({ id: expect.any(String) });
    await report(kofi, { targetType: 'post', targetId: target.id, reason: 'spam' }).expect(201);
    expect(
      (await report(kofi, { targetType: 'post', targetId: target.id, reason: 'spam' }).expect(409))
        .body.code,
    ).toBe('TRUST_REPORT_DUPLICATE');
    expect(
      (await report(amina, { targetType: 'post', targetId: target.id, reason: 'spam' }).expect(422))
        .body.code,
    ).toBe('TRUST_SELF_REPORT');
    // A message is reported by a participant only, never without an account.
    await request(app.getHttpServer())
      .post('/v1/public/reports')
      .send({ targetType: 'message', targetId: target.id, details: 'x', goodFaith: true })
      .expect(404);

    const found = await caseOf(target.id);
    expect(found).toMatchObject({
      targetType: 'post',
      reportCount: 2,
      status: 'open',
      priority: 85,
      priorityReasons: ['reason:illegal_content', 'reports:2'],
    });
    expect(found.reasons.sort()).toEqual(['illegal_content', 'spam']);
    expect(found).not.toHaveProperty('subjectEmail');

    await relayAll(worker);
    expect(await notificationOf(worker, kofi, 'report_received')).toMatchObject({
      target: { type: 'reports' },
    });
    await mailpit.waitFor('notifier@example.com', 'Votre signalement a bien été reçu');

    // Notices without an account are limited per address.
    let status = 201;
    for (let attempt = 0; attempt < 6 && status !== 429; attempt += 1) {
      status = (
        await request(app.getHttpServer())
          .post('/v1/public/reports')
          .send({ targetType: 'post', targetId: target.id, details: 'Encore.', goodFaith: true })
      ).status;
    }
    expect(status).toBe(429);
  });

  it('gives the moderator the reported message and three messages before it, no more', async () => {
    await connectMembers(amina, kofi);
    const kofiHandle = await handleOf(kofi);
    const sent = [];
    for (let index = 1; index <= 6; index += 1) {
      sent.push(await write(amina, kofiHandle, `Message ${index}`));
    }
    const reported = sent[4]!;
    await report(kofi, {
      targetType: 'message',
      targetId: reported.id,
      reason: 'harassment',
    }).expect(201);
    // Someone outside the conversation cannot report it.
    await report(reviewer, {
      targetType: 'message',
      targetId: reported.id,
      reason: 'harassment',
    }).expect(404);

    const found = await caseOf(reported.id);
    const detail = (await moderator.agent.get(`/v1/admin/moderation/cases/${found.id}`).expect(200))
      .body as ModerationCaseDetail;
    const context = detail.reports[0]?.messageContext;
    expect(context?.messages.map((message) => message.text)).toEqual([
      'Message 2',
      'Message 3',
      'Message 4',
      'Message 5',
    ]);
    expect(context?.messages.filter((message) => message.reported)).toHaveLength(1);
    expect(detail.subjectId).toBe(amina.userId);
  });

  it('decides with a statement of reasons, and another moderator overturns it on appeal', async () => {
    const target = await post(amina, 'Une publication contestée.');
    await report(kofi, { targetType: 'post', targetId: target.id, reason: 'harassment' }).expect(
      201,
    );
    const found = await caseOf(target.id);
    await moderator.agent
      .post(`/v1/admin/moderation/cases/${found.id}/assignment`)
      .set('Idempotency-Key', randomUUID())
      .send({ moderatorId: moderator.userId })
      .expect(200);
    // A member may not decide.
    await decide(kofi, found.id, { kind: 'remove' }).expect(403);
    const decided = await decide(moderator, found.id, { kind: 'remove', reason: 'harassment' });
    expect(decided.status, JSON.stringify(decided.body)).toBe(201);
    const decision = decided.body as ModerationDecisionDetail;
    expect(decision).toMatchObject({
      kind: 'remove',
      statement: STATEMENT,
      decidedBy: moderator.userId,
    });
    await kofi.agent.get(`/v1/posts/${target.id}`).expect(404);
    expect((await decide(moderator, found.id, { kind: 'warn' }).expect(409)).body.code).toBe(
      'TRUST_CASE_RESOLVED',
    );

    // The member concerned reads the statement, in the app and in the email.
    expect(await notificationOf(worker, amina, 'moderation_decision')).toMatchObject({
      data: { kind: 'remove', detail: STATEMENT },
    });
    const email = await mailpit.waitFor(amina.email, 'Une décision de modération vous concerne');
    expect(email.text).toContain(STATEMENT);
    expect(await notificationOf(worker, kofi, 'report_resolved')).toMatchObject({
      data: { outcome: 'action_taken' },
    });
    const standing = (await amina.agent.get('/v1/me/moderation').expect(200))
      .body as ModerationStanding;
    expect(standing.decisions[0]).toMatchObject({
      id: decision.id,
      ground: 'terms',
      automatedDetection: false,
      appealableUntil: expect.any(String),
    });

    const appeal = (statement: string, member = amina) =>
      member.agent
        .post(`/v1/me/moderation/decisions/${decision.id}/appeal`)
        .set('Idempotency-Key', randomUUID())
        .send({ statement });
    await appeal('Ce n’était pas insultant.', kofi).expect(404);
    const appealed = (await appeal('Ce n’était pas insultant.').expect(201)).body as { id: string };
    expect((await appeal('Encore.').expect(409)).body.code).toBe('TRUST_APPEAL_EXISTS');

    const resolve = (member: Member) =>
      member.agent
        .post(`/v1/admin/moderation/appeals/${appealed.id}/resolution`)
        .set('Idempotency-Key', randomUUID())
        .send({
          outcome: 'overturned',
          statement: 'Après réexamen, le ton reste dans les limites.',
        });
    expect((await resolve(moderator).expect(403)).body.code).toBe('TRUST_SAME_MODERATOR');
    const resolved = (await resolve(reviewer).expect(200)).body as ModerationDecisionDetail;
    expect(resolved).toMatchObject({
      appealReviewerId: reviewer.userId,
      appeal: { status: 'overturned' },
    });
    await kofi.agent.get(`/v1/posts/${target.id}`).expect(200);
    expect(await notificationOf(worker, amina, 'appeal_decided')).toMatchObject({
      data: { outcome: 'overturned' },
    });
  });

  it('suspends a member: sessions revoked, only the notice and the appeal remain', async () => {
    const aminaHandle = await handleOf(amina);
    await report(kofi, { targetType: 'profile', targetId: aminaHandle, reason: 'fraud' }).expect(
      201,
    );
    const found = await caseOf(amina.userId);
    // A moderator suspends up to 30 days, longer and for good is for administrators.
    expect(
      (await decide(moderator, found.id, { kind: 'suspend', suspensionDays: 60 }).expect(403)).body
        .code,
    ).toBe('TRUST_ADMIN_REQUIRED');
    expect((await decide(moderator, found.id, { kind: 'hide' }).expect(422)).body.code).toBe(
      'TRUST_DECISION_NOT_APPLICABLE',
    );
    await decide(moderator, found.id, { kind: 'suspend', suspensionDays: 7 }).expect(201);

    await amina.agent.get('/v1/me').expect(401);
    const again: Member = { ...amina, agent: browser(app) };
    await signIn(again.agent, amina.email);
    await again.agent.get('/v1/me').expect(200);
    const refused = await again.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Toujours là', visibility: 'members' })
      .expect(403);
    expect(refused.body.code).toBe('ACCESS_ACCOUNT_SUSPENDED');
    const standing = (await again.agent.get('/v1/me/moderation').expect(200))
      .body as ModerationStanding;
    expect(standing.suspension).toMatchObject({ userId: amina.userId, liftedAt: null });
    await again.agent
      .post(`/v1/me/moderation/decisions/${standing.decisions[0]!.id}/appeal`)
      .set('Idempotency-Key', randomUUID())
      .send({ statement: 'Je conteste.' })
      .expect(201);
    expect(await notificationOf(worker, again, 'suspension_started')).toBeDefined();

    await moderator.agent
      .post(`/v1/admin/moderation/suspensions/${standing.suspension!.id}/lift`)
      .set('Idempotency-Key', randomUUID())
      .send({ statement: 'Levée après vérification de l’identité du membre.' })
      .expect(200);
    await again.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'De retour', visibility: 'members' })
      .expect(201);
  });

  it('puts fraud on a project in funding first and freezes it, admins only', async () => {
    const older = await post(kofi, 'Une publication signalée avant.');
    await report(amina, {
      targetType: 'post',
      targetId: older.id,
      reason: 'illegal_content',
    }).expect(201);
    const owner = await entrepreneur(app, 'owner@example.com', 'Porteur');
    const project: Project = await publishedProject(owner);
    await report(kofi, { targetType: 'project', targetId: project.id, reason: 'fraud' }).expect(
      201,
    );
    const [first] = await queue(moderator);
    expect(first).toMatchObject({
      targetId: project.id,
      priority: 1000,
      priorityReasons: ['funding_fraud', 'reason:fraud'],
    });

    expect(
      (await decide(moderator, first!.id, { kind: 'freeze_project' }).expect(403)).body.code,
    ).toBe('TRUST_ADMIN_REQUIRED');
    const frozen = (
      await decide(admin, first!.id, { kind: 'freeze_project', reason: 'fraud' }).expect(201)
    ).body as ModerationDecisionDetail;
    const page = (await kofi.agent.get(`/v1/projects/${project.id}`).expect(200))
      .body as Project & {
      fundingFrozen: boolean;
    };
    expect(page.fundingFrozen).toBe(true);
    const refused = await contribute(kofi, project.id, { kind: 'donation', amount: eur(20) }, 409);
    expect((refused as unknown as { code: string }).code).toBe('PAYMENTS_PROJECT_NOT_OPEN');

    const refunds = (decisionId: string) =>
      admin.agent
        .post(`/v1/admin/moderation/projects/${project.id}/refunds`)
        .set('Idempotency-Key', randomUUID())
        .send({ decisionId, reason: 'Fraude établie' });
    expect((await refunds(v7()).expect(409)).body.code).toBe('TRUST_PROJECT_NOT_FROZEN');
    expect((await refunds(frozen.id).expect(202)).body).toEqual({ queued: 0 });

    const today = new Date().toISOString().slice(0, 10);
    const transparency = await admin.agent
      .get(`/v1/admin/moderation/transparency?from=${today}&to=${today}`)
      .expect(200);
    expect(transparency.body).toMatchObject({
      reports: { total: 2, byReason: { fraud: 1, illegal_content: 1 } },
      decisions: { byKind: { freeze_project: 1 } },
    });
    await moderator.agent
      .get(`/v1/admin/moderation/transparency?from=${today}&to=${today}`)
      .expect(403);
  });
});
