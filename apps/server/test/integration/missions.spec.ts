import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { MissionEngagement, MissionView, Notification } from '@pitchorium/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { createFullWorker, notificationOf, relayAll } from './support/full-worker';
import { ENTREPRENEUR_FACET } from './support/impact';
import { createMember, type Member } from './support/members';
import { handleOf } from './support/messaging';

const OFFER = {
  title: 'Revue de votre plan de financement',
  description: 'Deux sessions pour relire le plan et préparer une levée de fonds.',
  kind: 'expertise',
  domain: 'Finance',
  sectorCodes: ['agriculture_forestry_fishing'],
  format: 'session',
  estimatedHours: 4,
  mode: 'remote',
  languages: ['fr'],
  capacity: 1,
};

/** Volunteer missions (ADR 0071): from the offer to the hours confirmed in the dashboard. */
describe('missions', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let kofi: Member;
  let fatou: Member;
  let awa: Member;

  const contributor = (member: Member, hats: string[]) =>
    member.agent
      .post('/v1/me/profile/contributor-facet')
      .set('Idempotency-Key', randomUUID())
      .send({ hats, structureType: 'individual' })
      .expect(201);
  const entrepreneur = (member: Member) =>
    member.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', randomUUID())
      .send(ENTREPRENEUR_FACET)
      .expect(201);
  const offer = (member: Member, body: object = OFFER) =>
    member.agent.post('/v1/missions/offers').set('Idempotency-Key', randomUUID()).send(body);
  const engage = (member: Member, missionId: string, message = 'Votre aide sur notre plan ?') =>
    member.agent
      .post(`/v1/missions/${missionId}/engagements`)
      .set('Idempotency-Key', randomUUID())
      .send({ message });

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    worker = await createFullWorker();
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    fatou = await createMember(app, 'fatou@example.com', { name: 'Fatou Sow' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    for (const member of [kofi, fatou, awa]) await handleOf(member);
  });

  it('runs a mission from the offer to the hours confirmed in the impact dashboard', async () => {
    await contributor(kofi, ['expert']);
    await entrepreneur(fatou);
    const created = await offer(kofi).expect(201);
    const mission = created.body as MissionView;
    expect(mission).toMatchObject({ direction: 'offer', status: 'open', activeEngagements: 0 });

    // The entrepreneur asks, the expert is told and accepts.
    const asked = await engage(fatou, mission.id).expect(201);
    const engagement = asked.body as MissionEngagement;
    expect(engagement).toMatchObject({ status: 'requested', timeEntry: null });
    expect((await engage(fatou, mission.id).expect(409)).body.code).toBe(
      'MISSIONS_ENGAGEMENT_EXISTS',
    );
    expect(await notificationOf(worker, kofi, 'mission_engagement_requested')).toMatchObject({
      actors: [{ handle: await handleOf(fatou) }],
      target: { type: 'mission_engagement', key: engagement.id },
    });
    await kofi.agent
      .post(`/v1/mission-engagements/${engagement.id}/accept`)
      .send({ message: 'Avec plaisir.' })
      .expect(200);
    expect(await notificationOf(worker, fatou, 'mission_engagement_answered')).toMatchObject({
      data: { answer: 'accepted' },
    });
    // The beneficiary does not complete: the expert declares the time.
    await fatou.agent
      .post(`/v1/mission-engagements/${engagement.id}/complete`)
      .send({ minutes: 90, date: new Date().toISOString().slice(0, 10), description: 'x' })
      .expect(403);

    // The capacity of the offer holds while the mission is in progress.
    await entrepreneur(awa);
    const second = (await engage(awa, mission.id).expect(201)).body as MissionEngagement;
    const full = await kofi.agent
      .post(`/v1/mission-engagements/${second.id}/accept`)
      .send({})
      .expect(409);
    expect(full.body.code).toBe('MISSIONS_CAPACITY_REACHED');

    // Completion: the time is declared once in the shared time log, for the beneficiary.
    const completed = await kofi.agent
      .post(`/v1/mission-engagements/${engagement.id}/complete`)
      .send({
        minutes: 90,
        date: new Date().toISOString().slice(0, 10),
        description: 'Deux sessions sur le plan de financement',
      })
      .expect(200);
    const done = completed.body as MissionEngagement;
    expect(done).toMatchObject({
      status: 'completed',
      timeEntry: { minutes: 90, status: 'declared' },
    });
    await notificationOf(worker, fatou, 'mission_completed');
    const fatouNotifications = (
      (await fatou.agent.get('/v1/me/notifications').expect(200)).body as { items: Notification[] }
    ).items;
    expect(fatouNotifications.map((item) => item.type)).not.toContain('time_entry_declared');

    // The beneficiary confirms in the time log: the hours reach the impact dashboard.
    await fatou.agent.post(`/v1/time-entries/${done.timeEntry!.id}/confirm`).expect(200);
    const dashboard = await kofi.agent.get('/v1/me/impact-dashboard').expect(200);
    expect(dashboard.body.minutes).toEqual({ declared: 90, confirmed: 90, disputed: 0 });
    const read = await kofi.agent.get(`/v1/mission-engagements/${engagement.id}`).expect(200);
    expect(read.body.timeEntry).toMatchObject({ status: 'confirmed' });
    // A third member sees nothing of it.
    await awa.agent.get(`/v1/mission-engagements/${engagement.id}`).expect(404);
    await relayAll(worker);
  });

  it('keeps missions volunteer: hats, strict fields, no job vocabulary, short durations', async () => {
    const missing = await offer(awa).expect(403);
    expect(missing.body).toMatchObject({
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['profile.contributor_facet'],
    });
    await contributor(awa, ['recruiter']);
    expect((await offer(awa).expect(403)).body.code).toBe('MISSIONS_HAT_REQUIRED');

    await contributor(kofi, ['expert', 'mentor']);
    expect(
      (await offer(kofi, { ...OFFER, description: 'Poste en CDI, salaire attractif' }).expect(422))
        .body.code,
    ).toBe('MISSIONS_JOB_POSTING_REFUSED');
    expect((await offer(kofi, { ...OFFER, salary: '3000 EUR' }).expect(400)).body.code).toBe(
      'VALIDATION_FAILED',
    );
    expect((await offer(kofi, { ...OFFER, estimatedHours: 12 }).expect(422)).body.code).toBe(
      'MISSIONS_HOURS_EXCEEDED',
    );
    const mission = (await offer(kofi).expect(201)).body as MissionView;
    // Not on one's own mission; a member without entrepreneur facet nor project cannot ask.
    expect((await engage(kofi, mission.id).expect(422)).body.code).toBe('MISSIONS_OWN_MISSION');
    expect((await engage(awa, mission.id).expect(403)).body.code).toBe(
      'MISSIONS_BENEFICIARY_REQUIRED',
    );

    // A request of an entrepreneur, answered by an expert application.
    await entrepreneur(fatou);
    const request = await fatou.agent
      .post('/v1/missions/requests')
      .set('Idempotency-Key', randomUUID())
      .send({
        ...OFFER,
        title: 'Besoin : structurer notre export',
        kind: 'mentoring',
        skills: ['Export', 'CEDEAO'],
        desiredBy: '2026-12-31',
      })
      .expect(201);
    const application = (
      await engage(kofi, request.body.id as string, 'Je peux aider.').expect(201)
    ).body as MissionEngagement;
    expect(application).toMatchObject({ status: 'requested' });
    await notificationOf(worker, fatou, 'mission_engagement_requested');
    await fatou.agent
      .post(`/v1/mission-engagements/${application.id}/decline`)
      .send({})
      .expect(200);
    await notificationOf(worker, kofi, 'mission_engagement_answered');

    // Closed: no new engagement.
    await kofi.agent.post(`/v1/missions/${mission.id}/close`).expect(200);
    expect((await engage(fatou, mission.id).expect(409)).body.code).toBe('MISSIONS_CLOSED');
    const list = await fatou.agent.get('/v1/missions?direction=offer').expect(200);
    expect(list.body.items).toEqual([]);
  });
});
