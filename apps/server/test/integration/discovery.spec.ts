import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type {
  DiscoverPage,
  DiscoveryCard,
  FeedPage,
  Project,
  Suggestion,
} from '@pitchorium/contracts';
import { suggestionSentenceText } from '@pitchorium/i18n';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { IndexMaintenanceService } from '../../src/modules/discovery';
import { DISCOVERY_QUEUE } from '../../src/modules/discovery/interface/discovery-queue';
import { NotificationsMaintenanceService } from '../../src/modules/notifications/application/notifications-maintenance.service';
import { OutboxRelayService } from '../../src/platform/outbox';
import { QUEUE_NAMES } from '../../src/platform/queue';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { createFullWorker, notificationOf } from './support/full-worker';
import { createMember, ensureMinimumProfile, type Member } from './support/members';
import { handleOf } from './support/messaging';
import { publishedProject } from './support/payments';

/** Search, explained suggestions and Discover page (§10.2, §10.6, §11.4, ADR 0065 to 0068). */
describe('discovery', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let fatou: Member;
  let amina: Member;
  let kofi: Member;
  let awa: Member;
  let project: Project;

  /** Relays the outbox and waits for the handlers and the matching jobs to finish. */
  const settle = async () => {
    const relay = worker.get(OutboxRelayService);
    const queues = [QUEUE_NAMES.domainEvents, DISCOVERY_QUEUE].map((name) =>
      worker.get<Queue>(getQueueToken(name), { strict: false }),
    );
    await vi.waitFor(
      async () => {
        await relay.relayBatch();
        const [pending] = await query<{ count: string }>(
          'SELECT count(*) FROM platform.outbox_events WHERE published_at IS NULL',
        );
        expect(Number(pending?.count)).toBe(0);
        for (const queue of queues) {
          const counts = await queue.getJobCounts('active', 'waiting', 'prioritized', 'delayed');
          expect(
            (counts['active'] ?? 0) + (counts['waiting'] ?? 0) + (counts['prioritized'] ?? 0),
          ).toBe(0);
        }
      },
      { timeout: 60_000, interval: 200 },
    );
    // A failed job would leave stale suggestions silently.
    for (const queue of queues) {
      const failed = await queue.getJobs(['failed']);
      expect(failed.map((job) => `${job.name}: ${job.failedReason}`)).toEqual([]);
    }
  };
  const search = async (path: string, member: Member | null = fatou) => {
    const response = member
      ? await member.agent.get(path).expect(200)
      : await request(app.getHttpServer()).get(path).expect(200);
    return (response.body as { items: DiscoveryCard[] }).items;
  };
  const titles = (items: readonly { title: string }[]) => items.map((item) => item.title);
  const suggestions = async (member: Member, list: string) =>
    (
      (await member.agent.get(`/v1/discovery/suggestions?list=${list}`).expect(200)).body as {
        items: Suggestion[];
      }
    ).items;

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    // One listening server for every request (no ephemeral listen per request).
    await app.listen(0, '127.0.0.1');
    worker = await createFullWorker();
    await truncateAllTables();
    fatou = await createMember(app, 'fatou@example.com', { name: 'Fatou Sow' });
    amina = await createMember(app, 'amina@example.com', { name: 'Amina Diallo' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    for (const member of [fatou, amina, kofi, awa]) await handleOf(member);

    await fatou.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', randomUUID())
      .send({
        companyName: 'Sahel Agri',
        sectorCode: 'agriculture_forestry_fishing',
        stageCode: 'prototype',
        companyCountryCode: 'SN',
        needs: ['mentoring', 'funding'],
        fundingTarget: { amountMinor: '1000000', currency: 'EUR' },
      })
      .expect(201);
    await fatou.agent
      .patch('/v1/me/profile')
      .send({
        headline: 'Agripreneuse',
        bio: 'Irrigation solaire dans le delta du fleuve Sénégal.',
      })
      .expect(200);
    await amina.agent
      .post('/v1/me/profile/contributor-facet')
      .set('Idempotency-Key', randomUUID())
      .send({
        hats: ['mentor', 'investor'],
        structureType: 'individual',
        interventionCountryCodes: ['SN', 'CI'],
        sectorCodes: ['agriculture_forestry_fishing'],
        ticket: { minAmountMinor: '500000', maxAmountMinor: '5000000', currency: 'EUR' },
        acceptedInstruments: ['donation', 'reward_crowdfunding'],
        mentoringAvailable: true,
      })
      .expect(201);
    await kofi.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', randomUUID())
      .send({
        companyName: 'Accra Pack',
        sectorCode: 'manufacturing',
        stageCode: 'early_revenue',
        companyCountryCode: 'SN',
      })
      .expect(201);
    await amina.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Fondation Téranga', structureType: 'foundation', countryCodes: ['SN'] })
      .expect(201);
    project = await publishedProject(fatou, 'Sahel Agri : irrigation solaire');
    await settle();
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('indexes by events, rebuilds from the facades and finds then repairs a drift', async () => {
    const indexed = await query<{ kind: string; audiences: string }>(
      `SELECT kind, string_agg(audience, ',' ORDER BY audience) AS audiences
       FROM discovery.search_documents GROUP BY kind, entity_id ORDER BY kind`,
    );
    expect(indexed.filter((row) => row.kind === 'person')).toHaveLength(4);
    expect(indexed.filter((row) => row.kind === 'organization')).toEqual([
      { kind: 'organization', audiences: 'members,public' },
    ]);
    expect(indexed.filter((row) => row.kind === 'project')).toEqual([
      { kind: 'project', audiences: 'members,public' },
    ]);

    const maintenance = worker.get(IndexMaintenanceService);
    const rebuilt = await maintenance.rebuild();
    expect(rebuilt).toMatchObject({ removed: 0 });
    expect((await maintenance.checkDrift()).kinds).toEqual([]);

    // A missing document and a stale one are found, repaired, and the drift is published.
    await query(`DELETE FROM discovery.search_documents WHERE kind = 'organization'`);
    await query(
      `UPDATE discovery.search_documents SET fingerprint = 'stale' WHERE kind = 'project' AND audience = 'members'`,
    );
    const drift = await maintenance.checkDrift();
    expect(drift).toMatchObject({ missing: 1, stale: 1, orphaned: 0 });
    expect(drift.kinds.sort()).toEqual(['organization', 'project']);
    expect((await maintenance.checkDrift()).kinds).toEqual([]);
    const [event] = await query<{ payload: unknown }>(
      `SELECT payload FROM platform.outbox_events WHERE event_type = 'discovery.index.drift-detected.v1'`,
    );
    expect(event?.payload).toMatchObject({ missing: 1, stale: 1 });
  });

  it('finds despite typos and accents, in French and in English, names first', async () => {
    // A typo is tolerated on names; a word of the description must be right.
    expect(titles(await search('/v1/discovery/search?q=irigation'))).toEqual([
      'Sahel Agri : irrigation solaire',
    ]);
    expect(titles(await search('/v1/discovery/search?q=irrigation'))).toEqual([
      'Sahel Agri : irrigation solaire',
      'Fatou Sow',
    ]);
    expect(titles(await search('/v1/discovery/search?q=teranga&kinds=organization'))).toEqual([
      'Fondation Téranga',
    ]);
    expect(titles(await search('/v1/discovery/search?q=fondation%20t%C3%A9ranga'))).toContain(
      'Fondation Téranga',
    );
    // Labels of the codes, in French and in English.
    for (const word of ['senegal', 'Sénégal', 'agriculture', 'fishing', 'pêche']) {
      expect(
        titles(await search(`/v1/discovery/search?q=${encodeURIComponent(word)}&kinds=project`)),
        word,
      ).toEqual(['Sahel Agri : irrigation solaire']);
    }
    const complete = (await fatou.agent.get('/v1/discovery/autocomplete?q=sahe').expect(200))
      .body as { items: { title: string; kind: string }[] };
    expect(complete.items[0]).toMatchObject({
      kind: 'project',
      title: 'Sahel Agri : irrigation solaire',
    });
    expect(
      (
        (await fatou.agent.get('/v1/discovery/autocomplete?q=dialo').expect(200)).body as {
          items: { title: string }[];
        }
      ).items.map((item) => item.title),
    ).toContain('Amina Diallo');
  });

  it('shows the public to visitors, privacy to members, nothing across a block nor of a draft', async () => {
    // Without public page, a member is not found by a visitor.
    expect(titles(await search('/v1/public/discovery/search?q=fatou', null))).toEqual([]);
    await fatou.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    await settle();
    expect(titles(await search('/v1/public/discovery/search?q=fatou', null))).toEqual([
      'Fatou Sow',
    ]);
    // Her entrepreneur details are for members: a visitor does not find her by her company.
    expect(titles(await search('/v1/public/discovery/search?q=sahel&kinds=person', null))).toEqual(
      [],
    );
    expect(titles(await search('/v1/discovery/search?q=sahel&kinds=person', awa))).toEqual([
      'Fatou Sow',
    ]);
    const visitor = await request(app.getHttpServer())
      .get('/v1/public/discovery/search?q=irrigation')
      .expect(200);
    expect(visitor.headers['cache-control']).toBe('public, max-age=60');

    // Private contributor details are searchable by nobody else.
    await amina.agent
      .patch('/v1/me/profile/visibility')
      .send({ contributorDetails: 'private' })
      .expect(200);
    await settle();
    expect(titles(await search('/v1/discovery/search?hat=mentor', awa))).toEqual([]);

    // A blocked member and their projects disappear.
    await awa.agent.put(`/v1/network/blocks/${await handleOf(fatou)}`).expect(204);
    expect(titles(await search('/v1/discovery/search?q=irrigation', awa))).toEqual([]);
    await awa.agent.delete(`/v1/network/blocks/${await handleOf(fatou)}`).expect(204);

    // A draft is never indexed.
    await fatou.agent
      .post('/v1/projects')
      .set('Idempotency-Key', randomUUID())
      .send({ title: 'Brouillon secret', countryCodes: ['SN'], instruments: ['donation'] })
      .expect(201);
    await settle();
    expect(titles(await search('/v1/discovery/search?q=brouillon', awa))).toEqual([]);
    await amina.agent
      .patch('/v1/me/profile/visibility')
      .send({ contributorDetails: 'members' })
      .expect(200);
    await settle();
  });

  it('filters projects by country, sector, status and minimum impact', async () => {
    const projects = (filters: string) =>
      search(`/v1/discovery/search?${filters}`).then((items) =>
        items.filter((item) => item.kind === 'project').map((item) => item.title),
      );
    expect(await projects('countryCode=SN&kinds=project')).toEqual([
      'Sahel Agri : irrigation solaire',
    ]);
    expect(await projects('countryCode=GH&kinds=project')).toEqual([]);
    expect(await projects('sectorCode=agriculture_forestry_fishing&kinds=project')).toHaveLength(1);
    // A status filter restricts the search to projects.
    const funding = await search('/v1/discovery/search?projectStatus=funding');
    expect(funding.map((item) => item.kind)).toEqual(['project']);
    expect(await projects('projectStatus=closed')).toEqual([]);
    // No methodology published: no score, the project does not reach a minimum impact.
    expect(await projects('minImpact=40')).toEqual([]);
  });

  it('explains suggestions, updates them after a profile change, keeps « pas intéressé »', async () => {
    const people = await suggestions(fatou, 'people');
    const aminaSuggestion = people.find((item) => item.candidate.title === 'Amina Diallo');
    expect(aminaSuggestion?.reasons.map((reason) => reason.rule)).toEqual([
      'need_matches_hat',
      'shared_sector',
      'country_in_intervention',
      'mentoring_available',
      'ticket_fits_target',
    ]);
    expect(suggestionSentenceText('fr', aminaSuggestion!.sentence)).toBe(
      'Peut répondre à votre besoin : Mentorat · secteur commun : Agriculture',
    );
    const complementary = await suggestions(fatou, 'complementary_entrepreneurs');
    expect(complementary.map((item) => item.candidate.title)).toEqual(['Kofi Mensah']);
    expect(complementary[0]?.reasons[0]?.rule).toBe('same_country_other_sector');
    const forAmina = await suggestions(amina, 'projects');
    expect(forAmina.map((item) => item.candidate.title)).toEqual([
      'Sahel Agri : irrigation solaire',
    ]);
    const team = await fatou.agent
      .get(`/v1/projects/${project.id}/suggested-contributors`)
      .expect(200);
    expect(
      (team.body as { items: Suggestion[] }).items.map((item) => item.candidate.title),
    ).toEqual(['Amina Diallo']);
    await amina.agent.get(`/v1/projects/${project.id}/suggested-contributors`).expect(404);

    // Amina leaves agriculture and Senegal: the reasons follow, incrementally.
    await amina.agent
      .patch('/v1/me/profile/contributor-facet')
      .send({ sectorCodes: ['manufacturing'], interventionCountryCodes: ['GH'] })
      .expect(200);
    await settle();
    const updated = (await suggestions(fatou, 'people')).find(
      (item) => item.candidate.title === 'Amina Diallo',
    );
    expect(updated?.reasons.map((reason) => reason.rule)).toEqual([
      'need_matches_hat',
      'mentoring_available',
      'ticket_fits_target',
    ]);
    expect((await suggestions(amina, 'projects')).map((item) => item.candidate.title)).toEqual([
      'Sahel Agri : irrigation solaire',
    ]);

    // « Pas intéressé » : gone for good, and the dismissal is recorded.
    await fatou.agent
      .post('/v1/discovery/dismissals')
      .send({ kind: 'person', key: await handleOf(amina) })
      .expect(204);
    expect((await suggestions(fatou, 'people')).map((item) => item.candidate.title)).not.toContain(
      'Amina Diallo',
    );
    const [dismissed] = await query<{ count: string }>(
      `SELECT count(*) FROM platform.outbox_events WHERE event_type = 'discovery.suggestion.dismissed.v1'`,
    );
    expect(Number(dismissed?.count)).toBe(1);
    await fatou.agent
      .delete(`/v1/discovery/dismissals/person/${await handleOf(amina)}`)
      .expect(204);

    // A connection is no longer a suggestion.
    await ensureMinimumProfile(fatou);
    const sent = await fatou.agent
      .post('/v1/network/connection-requests')
      .set('Idempotency-Key', randomUUID())
      .send({ handle: await handleOf(kofi) })
      .expect(201);
    await kofi.agent.post(`/v1/network/connection-requests/${sent.body.id}/accept`).expect(200);
    expect(await suggestions(fatou, 'complementary_entrepreneurs')).toEqual([]);

    // New suggestions of the previous day: one grouped notification, low priority.
    await query(
      `UPDATE discovery.suggestions SET first_suggested_at = now() - interval '1 day'
       WHERE subject_id = $1`,
      [amina.userId],
    );
    await worker.get(NotificationsMaintenanceService).newSuggestions();
    expect(await notificationOf(worker, amina, 'new_suggestions')).toMatchObject({
      priority: 'low',
      target: { type: 'suggestions' },
    });
  });

  it('completes a small feed with suggestions and fills the Discover page', async () => {
    const feed = (await awa.agent.get('/v1/feed').expect(200)).body as FeedPage;
    expect(feed.schemaVersion).toBe(1);
    const fromAmina = (await amina.agent.get('/v1/feed').expect(200)).body as FeedPage;
    const items = fromAmina.items.filter((item) => item.type === 'suggestion');
    expect(items.length).toBeGreaterThan(0);
    // The best of each list in turn: a person, then a project.
    expect(
      items.map((item) => item.type === 'suggestion' && item.suggestion.candidate.kind),
    ).toEqual(['person', 'project', 'person']);
    expect(items[0]).toMatchObject({ suggestion: { sentence: { key: expect.any(String) } } });

    const page = (await fatou.agent.get('/v1/discovery/page?limit=4').expect(200))
      .body as DiscoverPage;
    const section = (name: string) => page.sections.find((item) => item.section === name);
    expect(page.sections.map((item) => item.section)).toEqual([
      'recent_projects',
      'ending_soon_projects',
      'suggested_profiles',
      'editorial',
      'upcoming_events',
      'open_missions',
    ]);
    expect(titles(section('recent_projects')!.items)).toEqual(['Sahel Agri : irrigation solaire']);
    expect(titles(section('ending_soon_projects')!.items)).toEqual([
      'Sahel Agri : irrigation solaire',
    ]);
    expect(section('suggested_profiles')!.sentences[0]).not.toBeNull();
    const visitor = (
      await request(app.getHttpServer()).get('/v1/public/discovery/page').expect(200)
    ).body as DiscoverPage;
    expect(visitor.sections.map((item) => item.section)).not.toContain('suggested_profiles');
    const next = await fatou.agent
      .get('/v1/discovery/sections/recent_projects?limit=1')
      .expect(200);
    expect(next.body.nextCursor).toBeNull();
  });
});
