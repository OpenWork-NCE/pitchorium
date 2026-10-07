import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ImpactAssessment, ImpactMethodologyDraft } from '@pitchorium/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { ENTREPRENEUR_FACET, testMethodology } from './support/impact';
import { createMember, grantRoleWith2fa, type Member } from './support/members';

/** Versioned methodology and self-declared assessments (section 12, ADR 0036). */
describe('impact', () => {
  let app: NestExpressApplication;
  let admin: Member;
  let ama: Member;

  async function draft(body: ImpactMethodologyDraft): Promise<string> {
    const created = await admin.agent
      .post('/v1/admin/impact/methodologies')
      .set('Idempotency-Key', `draft-${Math.random()}`)
      .send(body)
      .expect(201);
    return created.body.id as string;
  }

  const submit = (member: Member, methodologyId: string, answers: Record<string, string>) =>
    member.agent
      .post('/v1/me/impact/assessments')
      .set('Idempotency-Key', `assessment-${Math.random()}`)
      .send({ methodologyId, answers });

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    await ama.agent.get('/v1/me/profile').expect(200);
    await ama.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', 'ama-facet')
      .send(ENTREPRENEUR_FACET)
      .expect(201);
  });

  it('answers IMPACT_METHODOLOGY_UNAVAILABLE until a version is published', async () => {
    const none = await ama.agent.get('/v1/impact/methodology').expect(409);
    expect(none.body.code).toBe('IMPACT_METHODOLOGY_UNAVAILABLE');
    const refused = await submit(ama, '01900000-0000-7000-8000-000000000000', {});
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('IMPACT_METHODOLOGY_UNAVAILABLE');
    const history = await ama.agent.get('/v1/me/impact/assessments').expect(409);
    expect(history.body.code).toBe('IMPACT_METHODOLOGY_UNAVAILABLE');
  });

  it('publishes immutable versions, audited, and keeps assessments with their version', async () => {
    await ama.agent
      .post('/v1/admin/impact/methodologies')
      .set('Idempotency-Key', 'not-admin')
      .send(testMethodology())
      .expect(403);
    const v1 = await draft(testMethodology('Brouillon'));
    await admin.agent
      .put(`/v1/admin/impact/methodologies/${v1}`)
      .send(testMethodology())
      .expect(200);
    const published = await admin.agent
      .post(`/v1/admin/impact/methodologies/${v1}/publish`)
      .expect(200);
    expect(published.body).toMatchObject({ version: 1, status: 'published', name: 'Test V1' });
    const changed = await admin.agent
      .put(`/v1/admin/impact/methodologies/${v1}`)
      .send(testMethodology('Changed'))
      .expect(409);
    expect(changed.body.code).toBe('IMPACT_METHODOLOGY_NOT_DRAFT');
    expect((await ama.agent.get('/v1/impact/methodology').expect(200)).body.id).toBe(v1);

    const invalid = await submit(ama, v1, { jobs: 'full' });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('IMPACT_ANSWERS_INVALID');
    // jobs (weight 1) full, climate (weight 2) partial: (1 + 2 * 1/2) / 3 = 66.67 %.
    const first = await submit(ama, v1, { jobs: 'full', climate: 'partial' });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({
      selfDeclared: true,
      score: 67,
      level: 'moderate',
      methodology: { id: v1, version: 1, demo: false },
      reassessmentSuggested: false,
    });
    expect((first.body as ImpactAssessment).details).toHaveLength(2);
    expect((await submit(ama, v1, { jobs: 'full', climate: 'full' })).body.score).toBe(100);

    const v2 = await draft(testMethodology('Test V2'));
    await admin.agent.post(`/v1/admin/impact/methodologies/${v2}/publish`).expect(200);
    const list = await admin.agent.get('/v1/admin/impact/methodologies').expect(200);
    expect(
      (list.body.items as { version: number; status: string }[]).map((item) => [
        item.version,
        item.status,
      ]),
    ).toEqual([
      [2, 'published'],
      [1, 'archived'],
    ]);
    const outdated = await submit(ama, v1, { jobs: 'full', climate: 'full' });
    expect(outdated.body.code).toBe('IMPACT_METHODOLOGY_OUTDATED');
    const history = await ama.agent.get('/v1/me/impact/assessments').expect(200);
    expect(
      (history.body.items as ImpactAssessment[]).map((item) => [
        item.score,
        item.methodology.version,
        item.reassessmentSuggested,
      ]),
    ).toEqual([
      [100, 1, true],
      [67, 1, true],
    ]);

    const events = await query<{ event_type: string }>(
      `SELECT event_type FROM platform.outbox_events
       WHERE event_type LIKE 'impact.%' ORDER BY occurred_at, event_type`,
    );
    expect(events.map((event) => event.event_type)).toEqual([
      'impact.methodology.published.v1',
      'impact.assessment.submitted.v1',
      'impact.assessment.updated.v1',
      'impact.methodology.published.v1',
    ]);
    const audit = await query<{ action: string }>(
      `SELECT action FROM platform.audit_log
       WHERE target_type = 'impact_methodology' ORDER BY occurred_at`,
    );
    expect(audit.map((entry) => entry.action)).toEqual([
      'impact.methodology-drafted',
      'impact.methodology-updated',
      'impact.methodology-published',
      'impact.methodology-drafted',
      'impact.methodology-published',
    ]);
  });

  it('requires an entrepreneur facet to assess, and admins to archive', async () => {
    const v1 = await draft(testMethodology());
    await admin.agent.post(`/v1/admin/impact/methodologies/${v1}/publish`).expect(200);
    const kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    const refused = await submit(kofi, v1, { jobs: 'full', climate: 'full' });
    expect(refused.status).toBe(403);
    expect(refused.body.missing).toEqual(['profile.entrepreneur_facet']);
    await admin.agent.post(`/v1/admin/impact/methodologies/${v1}/archive`).expect(200);
    await ama.agent.get('/v1/impact/methodology').expect(409);
  });
});
