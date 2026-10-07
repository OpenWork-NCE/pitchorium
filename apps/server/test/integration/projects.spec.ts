import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type {
  CursorPage,
  FeedPage,
  ImpactAssessment,
  Project,
  ProjectCard,
  ProjectInterest,
} from '@pitchorium/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentModule } from '../../src/modules/content';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { NetworkModule } from '../../src/modules/network';
import { OrganizationsModule } from '../../src/modules/organizations';
import { ProfilesModule } from '../../src/modules/profiles';
import { ProjectsFacade, ProjectsModule } from '../../src/modules/projects';
import { ProjectMaintenanceService } from '../../src/modules/projects/application/project-maintenance.service';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { Money } from '../../src/platform/kernel';
import { MailerModule } from '../../src/platform/mailer';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { ENTREPRENEUR_FACET, testMethodology } from './support/impact';
import { createMember, grantRoleWith2fa, type Member } from './support/members';
import { createWorkerTestingModule } from './support/worker-testing-module';

const eur = (amount: number) => ({ amountMinor: String(amount * 100), currency: 'EUR' });

/** Every field required for publication, without tiers. */
const COMPLETE = {
  title: 'Sahel Agri : irrigation solaire',
  summary: 'Des pompes solaires pour 40 exploitations du delta.',
  description: '## Notre histoire\n\nUne **coopérative** de 40 exploitations.',
  sectorCode: 'agriculture_forestry_fishing',
  impactArea: 'Delta du fleuve Sénégal',
  countryCodes: ['SN'],
  videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
  instruments: ['donation', 'reward_crowdfunding', 'love_money'],
  opensCapital: true,
  goal: eur(10_000),
  durationDays: 45,
};

const THREE_TIERS = [
  { threshold: eur(2_000), description: 'Étude du site' },
  { threshold: eur(6_000), description: 'Achat des pompes' },
  { threshold: eur(10_000), description: 'Installation et formation' },
];

/** Projects and campaigns (section 11), with impact, feed, posts and funding facade. */
describe('projects', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let ama: Member;
  let kofi: Member;

  async function entrepreneur(email: string, name: string): Promise<Member> {
    const member = await createMember(app, email, { name });
    await member.agent.get('/v1/me/profile').expect(200);
    await member.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', `facet-${email}`)
      .send(ENTREPRENEUR_FACET)
      .expect(201);
    return member;
  }

  async function create(owner: Member, body: object = COMPLETE): Promise<Project> {
    const response = await owner.agent
      .post('/v1/projects')
      .set('Idempotency-Key', `project-${Math.random()}`)
      .send(body);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body as Project;
  }

  async function publish(owner: Member, project: Project): Promise<Project> {
    await owner.agent
      .put(`/v1/projects/${project.id}/tiers`)
      .send({ tiers: THREE_TIERS })
      .expect(200);
    const published = await owner.agent
      .post(`/v1/projects/${project.id}/publish`)
      .send({ publicDisplayConsent: true });
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    return published.body as Project;
  }

  /** An administrator with two-factor authentication publishes a test methodology. */
  async function publishMethodology(): Promise<string> {
    const admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    const draft = await admin.agent
      .post('/v1/admin/impact/methodologies')
      .set('Idempotency-Key', `methodology-${Math.random()}`)
      .send(testMethodology())
      .expect(201);
    await admin.agent.post(`/v1/admin/impact/methodologies/${draft.body.id}/publish`).expect(200);
    return draft.body.id as string;
  }

  const eventTypes = async (prefix: string) =>
    (
      await query<{ event_type: string }>(
        `SELECT event_type FROM platform.outbox_events WHERE event_type LIKE $1
         ORDER BY occurred_at, event_type`,
        [`${prefix}%`],
      )
    ).map((event) => event.event_type);

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
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
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
        ContentModule.forWorker(),
        ImpactModule.forWorker(),
        ProjectsModule.forWorker(),
      ],
    );
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    ama = await entrepreneur('ama@example.com', 'Ama Owusu');
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    await kofi.agent.get('/v1/me/profile').expect(200);
  });

  it('prefills the project assessment from the facet once a methodology is published', async () => {
    const before = await create(ama, { title: 'Sans méthodologie' });
    expect(before.impactAssessment).toBeNull();
    const assessments = await ama.agent
      .get(`/v1/projects/${before.id}/impact-assessments`)
      .expect(409);
    expect(assessments.body.code).toBe('IMPACT_METHODOLOGY_UNAVAILABLE');

    const methodologyId = await publishMethodology();
    await ama.agent
      .post('/v1/me/impact/assessments')
      .set('Idempotency-Key', 'facet-assessment')
      .send({ methodologyId, answers: { jobs: 'full', climate: 'partial' } })
      .expect(201);
    const project = await create(ama, { title: 'Avec méthodologie' });
    expect(project.impactAssessment).toMatchObject({
      selfDeclared: true,
      score: 67,
      source: 'prefilled',
      methodology: { id: methodologyId, version: 1 },
    });
    expect(project.impact).toMatchObject({ selfDeclared: true, score: 67, level: 'moderate' });
    const prefill = await ama.agent
      .get(`/v1/projects/${project.id}/impact-assessments/prefill`)
      .expect(200);
    expect(prefill.body).toEqual({ methodologyId, answers: { jobs: 'full', climate: 'partial' } });
    // Adjustable by the team, never by another member.
    const adjusted = await ama.agent
      .post(`/v1/projects/${project.id}/impact-assessments`)
      .set('Idempotency-Key', 'project-assessment')
      .send({ methodologyId, answers: { jobs: 'full', climate: 'full' } })
      .expect(201);
    expect((adjusted.body as ImpactAssessment).score).toBe(100);
    await kofi.agent.get(`/v1/projects/${project.id}/impact-assessments`).expect(404);
    const history = await ama.agent
      .get(`/v1/projects/${project.id}/impact-assessments`)
      .expect(200);
    expect((history.body.items as ImpactAssessment[]).map((item) => item.source)).toEqual([
      'answered',
      'prefilled',
    ]);
    // With a published methodology, the showcase filters on the self-declared score.
    await ama.agent.patch(`/v1/projects/${project.id}`).send(COMPLETE).expect(200);
    await publish(ama, project);
    const filtered = async (minImpact: number) =>
      (
        (await kofi.agent.get(`/v1/projects?minImpact=${minImpact}`).expect(200))
          .body as CursorPage<ProjectCard>
      ).items.map((card) => card.id);
    expect(await filtered(70)).toEqual([project.id]);
    await ama.agent
      .post(`/v1/projects/${project.id}/impact-assessments`)
      .set('Idempotency-Key', 'project-assessment-2')
      .send({ methodologyId, answers: { jobs: 'none', climate: 'partial' } })
      .expect(201);
    expect(await filtered(70)).toEqual([]);
    expect(await filtered(0)).toEqual([project.id]);
    // The draft created before the methodology now needs an assessment to be published.
    await ama.agent.patch(`/v1/projects/${before.id}`).send(COMPLETE).expect(200);
    await ama.agent.put(`/v1/projects/${before.id}/tiers`).send({ tiers: THREE_TIERS }).expect(200);
    const refused = await ama.agent
      .post(`/v1/projects/${before.id}/publish`)
      .send({ publicDisplayConsent: true })
      .expect(422);
    expect(refused.body.code).toBe('PROJECTS_IMPACT_ASSESSMENT_REQUIRED');
  });

  it('runs a campaign from draft to closure, with idempotent funding and tiers', async () => {
    const draft = await create(ama, { title: 'Brouillon' });
    const incomplete = await ama.agent
      .post(`/v1/projects/${draft.id}/publish`)
      .send({ publicDisplayConsent: true })
      .expect(422);
    expect(incomplete.body).toMatchObject({ code: 'PROJECTS_NOT_PUBLISHABLE' });
    expect(incomplete.body.missing).toEqual(expect.arrayContaining(['summary', 'tiers', 'goal']));
    await ama.agent
      .post(`/v1/projects/${draft.id}/publish`)
      .send({ publicDisplayConsent: false })
      .expect(400);

    await ama.agent.patch(`/v1/projects/${draft.id}`).send(COMPLETE).expect(200);
    const tiers = await ama.agent
      .put(`/v1/projects/${draft.id}/tiers`)
      .send({ tiers: THREE_TIERS })
      .expect(200);
    expect((tiers.body as Project).funding.goal).toEqual(eur(10_000));
    const reward = await ama.agent
      .post(`/v1/projects/${draft.id}/rewards`)
      .set('Idempotency-Key', 'reward-1')
      .send({
        title: 'Panier du delta',
        description: 'Un panier de produits de la coopérative',
        minAmount: eur(50),
        instruments: ['reward_crowdfunding'],
        quantity: 100,
      })
      .expect(201);
    await ama.agent
      .post(`/v1/projects/${draft.id}/rewards`)
      .set('Idempotency-Key', 'reward-2')
      .send({
        title: 'Visite',
        description: 'Une visite des exploitations',
        minAmount: eur(500),
        instruments: ['donation', 'reward_crowdfunding'],
      })
      .expect(201);
    // Draft and preview: the team only.
    await kofi.agent.get(`/v1/projects/${draft.id}`).expect(404);
    await kofi.agent.get(`/v1/projects/${draft.id}/preview`).expect(404);
    const preview = await ama.agent.get(`/v1/projects/${draft.id}/preview`).expect(200);
    expect(preview.body).toMatchObject({
      status: 'draft',
      viewer: null,
      management: null,
      video: { embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' },
    });
    expect((preview.body as Project).team.map((member) => member.member.handle)).toEqual([
      'ama-owusu',
    ]);

    const published = await ama.agent
      .post(`/v1/projects/${draft.id}/publish`)
      .send({ publicDisplayConsent: true })
      .expect(200);
    expect(published.body).toMatchObject({ status: 'funding' });
    expect((published.body as Project).funding.daysLeft).toBe(45);
    expect((published.body as Project).management?.publicDisplayConsentAt).not.toBeNull();

    const facade = app.get(ProjectsFacade);
    const first = await facade.applyFunding(
      '01999999-0000-7000-8000-000000000001',
      draft.id,
      Money.of(300_000n, 'EUR'),
    );
    expect(first).toMatchObject({ status: 'funding', contributionCount: 1 });
    // The same contribution again changes nothing; with other values it conflicts.
    await facade.applyFunding(
      '01999999-0000-7000-8000-000000000001',
      draft.id,
      Money.of(300_000n, 'EUR'),
    );
    await expect(
      facade.applyFunding('01999999-0000-7000-8000-000000000001', draft.id, Money.of(1n, 'EUR')),
    ).rejects.toMatchObject({ code: 'PROJECTS_CONTRIBUTION_CONFLICT' });
    const funded = await facade.applyFunding(
      '01999999-0000-7000-8000-000000000002',
      draft.id,
      Money.of(800_000n, 'EUR'),
    );
    expect(funded).toMatchObject({ status: 'funded', contributionCount: 2 });
    expect(funded.collected.amountMinor).toBe(1_100_000n);
    expect(await eventTypes('projects.tier')).toEqual([
      'projects.tier.unlocked.v1',
      'projects.tier.unlocked.v1',
      'projects.tier.unlocked.v1',
    ]);

    // Amounts are locked after the first paid contribution; the texts stay editable, audited.
    const locked = await ama.agent
      .put(`/v1/projects/${draft.id}/tiers`)
      .send({ tiers: THREE_TIERS.slice(0, 2).concat({ threshold: eur(12_000), description: 'x' }) })
      .expect(409);
    expect(locked.body.code).toBe('PROJECTS_FUNDING_LOCKED');
    await ama.agent
      .patch(`/v1/projects/${draft.id}/rewards/${reward.body.id}`)
      .send({ minAmount: eur(60) })
      .expect(409);
    await ama.agent
      .patch(`/v1/projects/${draft.id}`)
      .send({ summary: 'Résumé corrigé après le lancement.' })
      .expect(200);
    const audit = await query<{ action: string }>(
      `SELECT action FROM platform.audit_log WHERE target_id = $1 ORDER BY occurred_at`,
      [draft.id],
    );
    expect(audit.map((entry) => entry.action)).toEqual([
      'projects.project-published',
      'projects.project-updated',
    ]);

    const reversed = await facade.reverseFunding('01999999-0000-7000-8000-000000000002');
    expect(reversed).toMatchObject({ status: 'funding', contributionCount: 1 });
    await facade.reverseFunding('01999999-0000-7000-8000-000000000002');
    const page = (await kofi.agent.get(`/v1/projects/${draft.id}`).expect(200)).body as Project;
    expect(page.funding).toMatchObject({ collected: eur(3_000), progressPercent: 30 });
    expect(page.tiers.map((tier) => [tier.unlocked, tier.unlockedAt !== null])).toEqual([
      [true, true],
      [false, true],
      [false, true],
    ]);

    await query(
      `UPDATE projects.projects SET ends_at = now() - interval '1 minute' WHERE id = $1`,
      [draft.id],
    );
    expect(await worker.get(ProjectMaintenanceService).closeEnded()).toBe(1);
    expect(await worker.get(ProjectMaintenanceService).closeEnded()).toBe(0);
    const closed = (await kofi.agent.get(`/v1/projects/${draft.id}`).expect(200)).body as Project;
    expect(closed.status).toBe('closed');
    expect(await eventTypes('projects.project')).toEqual([
      'projects.project.created.v1',
      'projects.project.updated.v1',
      'projects.project.updated.v1',
      'projects.project.published.v1',
      'projects.project.funded.v1',
      'projects.project.updated.v1',
      'projects.project.updated.v1',
      'projects.project.closed.v1',
    ]);
  });

  it('sells out a limited reward under concurrent reservations', async () => {
    const project = await publish(ama, await create(ama));
    const reward = await ama.agent
      .post(`/v1/projects/${project.id}/rewards`)
      .set('Idempotency-Key', 'limited')
      .send({
        title: 'Édition limitée',
        description: 'Dix paniers numérotés',
        minAmount: eur(100),
        instruments: ['reward_crowdfunding'],
        quantity: 10,
      })
      .expect(201);
    const facade = app.get(ProjectsFacade);
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) =>
        facade.reserve(
          reward.body.id as string,
          `01999999-0000-7000-8000-${String(index).padStart(12, '0')}`,
        ),
      ),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(
      results.every(
        (result) =>
          result.status === 'fulfilled' ||
          (result.reason as { code?: string }).code === 'PROJECTS_REWARD_SOLD_OUT',
      ),
    ).toBe(true);
    expect(await eventTypes('projects.reward.sold')).toEqual(['projects.reward.sold-out.v1']);
    const page = (await kofi.agent.get(`/v1/projects/${project.id}`).expect(200)).body as Project;
    expect(page.rewards.find((item) => item.id === reward.body.id)).toMatchObject({
      available: 0,
      soldOut: true,
    });
    await facade.release('01999999-0000-7000-8000-000000000000');
    await facade.confirm('01999999-0000-7000-8000-000000000001');
    const after = (await kofi.agent.get(`/v1/projects/${project.id}`).expect(200)).body as Project;
    expect(after.rewards.find((item) => item.id === reward.body.id)?.available).toBe(1);
  });

  it('shows an update in the feed of a follower and attaches posts of the team only', async () => {
    const project = await publish(ama, await create(ama));
    await kofi.agent.put(`/v1/network/follows/project/${project.id}`).expect(200);
    const update = await ama.agent
      .post(`/v1/projects/${project.id}/updates`)
      .set('Idempotency-Key', 'update-1')
      .send({ text: 'Les premières pompes sont arrivées.' })
      .expect(201);
    const feed = (await kofi.agent.get('/v1/feed').expect(200)).body as FeedPage;
    expect(feed.items[0]).toMatchObject({
      type: 'project_update',
      id: `project_update:${update.body.id}`,
      update: {
        text: 'Les premières pompes sont arrivées.',
        author: { handle: 'ama-owusu' },
        project: { id: project.id, slug: project.slug },
      },
    });
    expect(await eventTypes('projects.update')).toEqual(['projects.update.published.v1']);

    const outside = await kofi.agent
      .post('/v1/posts')
      .set('Idempotency-Key', 'outside')
      .send({ text: 'Je soutiens ce projet', projectId: project.id })
      .expect(422);
    expect(outside.body.code).toBe('CONTENT_PROJECT_NOT_FOUND');
    const attached = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', 'attached')
      .send({ text: 'Notre campagne est lancée', projectId: project.id, visibility: 'members' })
      .expect(201);
    const posts = await kofi.agent.get(`/v1/projects/${project.id}/posts`).expect(200);
    expect((posts.body as CursorPage<{ id: string }>).items.map((post) => post.id)).toEqual([
      attached.body.id,
    ]);
    // A members publication is not listed on the public page.
    const publicPosts = await request(app.getHttpServer())
      .get(`/v1/public/projects/${project.id}/posts`)
      .expect(200);
    expect(publicPosts.body.items).toEqual([]);
  });

  it('records expressions of interest for the team only', async () => {
    const project = await publish(ama, await create(ama));
    const interest = await kofi.agent
      .post(`/v1/projects/${project.id}/interests`)
      .set('Idempotency-Key', 'interest')
      .send({
        kind: 'grant',
        message: 'Notre fondation finance l’irrigation.',
        indicativeAmount: eur(5_000),
      })
      .expect(201);
    expect(interest.body).toMatchObject({
      kind: 'grant',
      indicativeAmount: eur(5_000),
      member: { handle: 'kofi-mensah' },
    });
    await kofi.agent.get(`/v1/projects/${project.id}/interests`).expect(403);
    const listed = await ama.agent.get(`/v1/projects/${project.id}/interests`).expect(200);
    expect((listed.body as CursorPage<ProjectInterest>).items).toHaveLength(1);
    expect(await eventTypes('projects.interest')).toEqual(['projects.interest.expressed.v1']);
  });

  it('filters and sorts the showcase, and serves the public page with redirects', async () => {
    const awa = await entrepreneur('awa@example.com', 'Awa Ndiaye');
    const senegal = await publish(ama, await create(ama));
    const ghana = await publish(
      awa,
      await create(awa, {
        ...COMPLETE,
        title: 'Accra recyclage',
        countryCodes: ['GH'],
        sectorCode: 'manufacturing',
        durationDays: 30,
      }),
    );
    await create(ama, { title: 'Brouillon invisible' });
    const ids = async (path: string) =>
      ((await kofi.agent.get(path).expect(200)).body as CursorPage<ProjectCard>).items.map(
        (card) => card.id,
      );
    expect(await ids('/v1/projects')).toEqual([ghana.id, senegal.id]);
    expect(await ids('/v1/projects?countryCode=SN')).toEqual([senegal.id]);
    expect(await ids('/v1/projects?sectorCode=manufacturing')).toEqual([ghana.id]);
    expect(await ids('/v1/projects?status=funded')).toEqual([]);
    expect(await ids('/v1/projects?sort=ending_soon')).toEqual([ghana.id, senegal.id]);
    // Without a published methodology, the impact filter is ignored.
    expect(await ids('/v1/projects?minImpact=70')).toEqual([ghana.id, senegal.id]);
    const firstPage = await kofi.agent.get('/v1/projects?limit=1').expect(200);
    expect(firstPage.body.nextCursor).not.toBeNull();
    expect(await ids(`/v1/projects?limit=1&cursor=${firstPage.body.nextCursor as string}`)).toEqual(
      [senegal.id],
    );

    await ama.agent
      .put(`/v1/projects/${senegal.id}/slug`)
      .send({ slug: 'irrigation-delta' })
      .expect(200);
    const visitor = request(app.getHttpServer());
    const moved = await visitor.get(`/v1/public/projects/${senegal.slug}`).expect(301);
    expect(moved.headers['location']).toBe('/v1/public/projects/irrigation-delta');
    const page = await visitor.get('/v1/public/projects/irrigation-delta').expect(200);
    expect(page.headers['cache-control']).toBe('public, max-age=60');
    expect(page.body).toMatchObject({
      slug: 'irrigation-delta',
      status: 'funding',
      documents: [],
      viewer: null,
      management: null,
      owner: { handle: 'ama-owusu' },
      share: { title: COMPLETE.title, description: COMPLETE.summary },
    });
    expect((page.body as Project).team).toHaveLength(1);
    expect((page.body as Project).tiers).toHaveLength(3);
    const showcase = await visitor.get('/v1/public/projects?featured=true').expect(200);
    expect(showcase.body.items).toEqual([]);
    await visitor.get('/v1/public/projects/brouillon-invisible').expect(404);
  });

  it('runs the team: invitation with consent, roles, and never without an owner', async () => {
    const project = await create(ama);
    await ama.agent
      .post(`/v1/projects/${project.id}/team/invitations`)
      .set('Idempotency-Key', 'invite')
      .send({ handle: 'kofi-mensah', role: 'editor', function: 'Trésorier' })
      .expect(204);
    const invitations = await kofi.agent.get('/v1/me/project-invitations').expect(200);
    expect(invitations.body.items).toEqual([
      expect.objectContaining({ role: 'editor', function: 'Trésorier' }),
    ]);
    await kofi.agent.patch(`/v1/projects/${project.id}`).send({ title: 'Non' }).expect(404);
    await kofi.agent
      .post(`/v1/me/project-invitations/${project.id}/accept`)
      .send({ publicDisplayConsent: true })
      .expect(204);
    await kofi.agent
      .patch(`/v1/projects/${project.id}`)
      .send({ title: 'Nouveau titre' })
      .expect(200);
    await kofi.agent.delete(`/v1/projects/${project.id}`).expect(403);
    const last = await ama.agent.post(`/v1/projects/${project.id}/team/leave`).expect(409);
    expect(last.body.code).toBe('PROJECTS_LAST_OWNER');
    await ama.agent
      .patch(`/v1/projects/${project.id}/team/kofi-mensah`)
      .send({ role: 'owner' })
      .expect(204);
    await ama.agent.post(`/v1/projects/${project.id}/team/leave`).expect(204);
    const view = (await kofi.agent.get(`/v1/projects/${project.id}`).expect(200)).body as Project;
    expect(view.owner?.handle).toBe('kofi-mensah');
    expect(await eventTypes('projects.team')).toEqual([
      'projects.team.member-added.v1',
      'projects.team.member-removed.v1',
    ]);
    await kofi.agent.delete(`/v1/projects/${project.id}`).expect(204);
    await kofi.agent.get(`/v1/projects/${project.id}`).expect(404);
  });
});
