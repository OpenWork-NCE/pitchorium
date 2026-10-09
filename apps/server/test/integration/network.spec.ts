import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { CursorPage, Follower, Organization } from '@pitchorium/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { IdentityModule } from '../../src/modules/identity';
import { MediaModule } from '../../src/modules/media';
import { NetworkModule } from '../../src/modules/network';
import { NetworkMaintenanceService } from '../../src/modules/network/application/network-maintenance.service';
import { OrganizationsModule } from '../../src/modules/organizations';
import { ProfilesModule } from '../../src/modules/profiles';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { browser, createMember, ensureMinimumProfile, type Member } from './support/members';
import { createWorkerTestingModule } from './support/worker-testing-module';

const ENTREPRENEUR = {
  companyName: 'Sahel Agri',
  sectorCode: 'agriculture_forestry_fishing',
  stageCode: 'prototype',
  companyCountryCode: 'SN',
};

/** Follows, connections, blocks, lists and profile views (§10.2, ADR 0027 to 0030). */
describe('network', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let ama: Member;
  let kofi: Member;

  const eventTypes = async () =>
    (
      await query<{ event_type: string }>(
        `SELECT event_type FROM platform.outbox_events
         WHERE event_type LIKE 'network.%' ORDER BY occurred_at, event_type`,
      )
    ).map((event) => event.event_type);

  async function requestConnection(from: Member, handle: string, note?: string) {
    await ensureMinimumProfile(from);
    return from.agent
      .post('/v1/network/connection-requests')
      .set('Idempotency-Key', `request-${handle}-${Math.random()}`)
      .send({ handle, ...(note ? { note } : {}) });
  }

  async function connect(a: Member, b: Member, bHandle: string): Promise<void> {
    const sent = await requestConnection(a, bHandle);
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    await b.agent.post(`/v1/network/connection-requests/${sent.body.id}/accept`).expect(200);
  }

  /** Member with a profile (the worker creates it after sign-up; GET /v1/me/profile too). */
  async function member(
    email: string,
    name: string,
    options: { verified?: boolean } = {},
  ): Promise<Member> {
    const created = await createMember(app, email, { name, ...options });
    await created.agent.get('/v1/me/profile').expect(200);
    return created;
  }

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], { NETWORK_CONNECTION_REQUESTS_PER_WEEK: '3' }));
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
      ],
    );
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    ama = await member('ama@example.com', 'Ama Owusu');
    kofi = await member('kofi@example.com', 'Kofi Mensah');
  });

  it('runs a connection from a request with a note to its removal', async () => {
    const sent = await requestConnection(ama, 'kofi-mensah', 'Nous nous sommes croisés à Dakar.');
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({
      direction: 'sent',
      status: 'pending',
      member: { handle: 'kofi-mensah', displayName: 'Kofi Mensah' },
    });
    const twice = await requestConnection(ama, 'kofi-mensah');
    expect(twice.body.code).toBe('NETWORK_REQUEST_ALREADY_PENDING');

    const received = await kofi.agent.get('/v1/me/network/connection-requests').expect(200);
    expect(received.body.items).toEqual([
      expect.objectContaining({
        direction: 'received',
        note: 'Nous nous sommes croisés à Dakar.',
        member: expect.objectContaining({ handle: 'ama-owusu' }),
      }),
    ]);
    await kofi.agent.post(`/v1/network/connection-requests/${sent.body.id}/accept`).expect(200);

    const relationship = await ama.agent
      .get('/v1/network/members/kofi-mensah/relationship')
      .expect(200);
    expect(relationship.body).toMatchObject({
      degree: 'first',
      connection: 'connected',
      following: true,
      followedBy: true,
      blocked: false,
      counts: { followers: 1, connections: 1 },
    });

    // Stopping to follow keeps the connection.
    await ama.agent.delete('/v1/network/follows/member/kofi-mensah').expect(204);
    const unfollowed = await ama.agent
      .get('/v1/network/members/kofi-mensah/relationship')
      .expect(200);
    expect(unfollowed.body).toMatchObject({ connection: 'connected', following: false });

    await ama.agent.delete('/v1/network/connections/kofi-mensah').expect(204);
    const removed = await kofi.agent.get('/v1/network/members/ama-owusu/relationship').expect(200);
    expect(removed.body).toMatchObject({
      degree: 'out_of_network',
      connection: 'none',
      following: false,
      followedBy: false,
    });
    // Events of one transaction share their timestamp: compared without order.
    expect((await eventTypes()).sort()).toEqual(
      [
        'network.connection.requested.v1',
        'network.connection.accepted.v1',
        'network.follow.created.v1',
        'network.follow.created.v1',
        'network.follow.removed.v1',
        'network.connection.removed.v1',
        'network.follow.removed.v1',
      ].sort(),
    );
  });

  it('enforces the decline cooldown, the weekly limit and a verified email', async () => {
    const declined = await requestConnection(ama, 'kofi-mensah');
    await kofi.agent
      .post(`/v1/network/connection-requests/${declined.body.id}/decline`)
      .expect(204);
    expect((await requestConnection(ama, 'kofi-mensah')).body.code).toBe(
      'NETWORK_REQUEST_COOLDOWN',
    );

    // A request answering a pending request of the other member accepts it.
    const awa = await member('awa@example.com', 'Awa Ndiaye');
    await requestConnection(awa, 'ama-owusu');
    const crossed = await requestConnection(ama, 'awa-ndiaye');
    expect(crossed.body).toMatchObject({ status: 'accepted', direction: 'received' });

    const withdrawn = await requestConnection(ama, 'test-member');
    expect(withdrawn.body.code).toBe('NETWORK_MEMBER_NOT_FOUND');
    const yaw = await member('yaw@example.com', 'Yaw Boateng');
    const pending = await requestConnection(ama, 'yaw-boateng');
    await ama.agent.delete(`/v1/network/connection-requests/${pending.body.id}`).expect(204);
    await yaw.agent.post(`/v1/network/connection-requests/${pending.body.id}/accept`).expect(409);

    // Limit of the test environment: three requests created this week (the declined one, the
    // withdrawn one, this one); the crossed request created none. The fourth is refused.
    await member('ife@example.com', 'Ife Adeyemi');
    expect((await requestConnection(ama, 'ife-adeyemi')).status).toBe(201);
    await member('tunde@example.com', 'Tunde Bakare');
    const limited = await requestConnection(ama, 'tunde-bakare');
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('NETWORK_WEEKLY_REQUEST_LIMIT');

    const unverified = await member('new@example.com', 'New Member', { verified: false });
    const refused = await requestConnection(unverified, 'kofi-mensah');
    expect(refused.status).toBe(403);
    expect(refused.body).toMatchObject({
      code: 'ACCESS_PREREQUISITES_MISSING',
      missing: ['email_verified'],
    });
  });

  it('blocks a member: removes every relation and forbids new ones', async () => {
    await connect(ama, kofi, 'kofi-mensah');
    await kofi.agent.put('/v1/network/blocks/ama-owusu').expect(204);

    const hidden = await ama.agent.get('/v1/network/members/kofi-mensah/relationship').expect(404);
    expect(hidden.body.code).toBe('NETWORK_MEMBER_NOT_FOUND');
    expect((await requestConnection(ama, 'kofi-mensah')).status).toBe(404);
    await ama.agent.put('/v1/network/follows/member/kofi-mensah').expect(404);
    const own = await kofi.agent.get('/v1/network/members/ama-owusu/relationship').expect(200);
    expect(own.body).toMatchObject({ connection: 'none', following: false, blocked: true });
    const connections = await query(
      'SELECT 1 FROM network.connections UNION ALL SELECT 1 FROM network.follows',
    );
    expect(connections).toEqual([]);
    const blocks = await kofi.agent.get('/v1/me/network/blocks').expect(200);
    expect(blocks.body.items).toEqual([
      expect.objectContaining({ member: expect.objectContaining({ handle: 'ama-owusu' }) }),
    ]);

    await kofi.agent.delete('/v1/network/blocks/ama-owusu').expect(204);
    const after = await ama.agent.get('/v1/network/members/kofi-mensah/relationship').expect(200);
    expect(after.body).toMatchObject({ connection: 'none', following: false });
    expect(await eventTypes()).toEqual(
      expect.arrayContaining(['network.block.created.v1', 'network.block.removed.v1']),
    );
  });

  it('hides the profiles of both members of a block, as if they did not exist', async () => {
    const awa = await member('awa@example.com', 'Awa Ndiaye');
    await kofi.agent.put('/v1/me/profile/handle').send({ handle: 'kofi-m' }).expect(200);
    const organization = await kofi.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', 'kofi-organization')
      .send({ name: 'Kofi Ventures', structureType: 'company', countryCodes: ['GH'] })
      .expect(201);
    const membersSeenBy = async (reader: Member) => {
      const page = await reader.agent
        .get(`/v1/organizations/by-slug/${organization.body.slug}`)
        .expect(200);
      return (page.body as Organization).members.map((card) => card.handle);
    };
    expect(await membersSeenBy(ama)).toEqual(['kofi-m']);
    const unknown = await ama.agent.get('/v1/profiles/nobody-here').expect(404);

    await kofi.agent.put('/v1/network/blocks/ama-owusu').expect(204);
    // Both ways, through the current and a former handle: the same answer as an unknown handle.
    for (const [reader, handle] of [
      [ama, 'kofi-m'],
      [ama, 'kofi-mensah'],
      [kofi, 'ama-owusu'],
    ] as const) {
      const hidden = await reader.agent.get(`/v1/profiles/${handle}`).expect(404);
      expect(hidden.body).toMatchObject({ code: unknown.body.code, title: unknown.body.title });
    }
    expect(await membersSeenBy(ama)).toEqual([]);
    await awa.agent.get('/v1/profiles/kofi-m').expect(200);
    await awa.agent.get('/v1/profiles/ama-owusu').expect(200);
    expect(await membersSeenBy(awa)).toEqual(['kofi-m']);

    await kofi.agent.delete('/v1/network/blocks/ama-owusu').expect(204);
    await ama.agent.get('/v1/profiles/kofi-m').expect(200);
    await kofi.agent.get('/v1/profiles/ama-owusu').expect(200);
  });

  it('shows the network lists according to their visibility', async () => {
    await connect(ama, kofi, 'kofi-mensah');
    const awa = await member('awa@example.com', 'Awa Ndiaye');
    await awa.agent.put('/v1/network/follows/member/kofi-mensah').expect(200);

    const followers = await ama.agent.get('/v1/network/members/kofi-mensah/followers').expect(200);
    expect(
      (followers.body as CursorPage<Follower>).items.map((item) => item.member.handle),
    ).toEqual(['awa-ndiaye', 'ama-owusu']);
    const firstPage = await ama.agent
      .get('/v1/network/members/kofi-mensah/followers?limit=1')
      .expect(200);
    const secondPage = await ama.agent
      .get(`/v1/network/members/kofi-mensah/followers?limit=1&cursor=${firstPage.body.nextCursor}`)
      .expect(200);
    expect(secondPage.body).toMatchObject({
      items: [
        expect.objectContaining({ member: expect.objectContaining({ handle: 'ama-owusu' }) }),
      ],
      nextCursor: null,
    });
    // Members only by default: no list without an account.
    await browser(app).get('/v1/public/network/members/kofi-mensah/followers').expect(404);

    await kofi.agent
      .patch('/v1/me/profile/visibility')
      .send({ networkLists: 'private' })
      .expect(200);
    const hidden = await ama.agent.get('/v1/network/members/kofi-mensah/connections').expect(403);
    expect(hidden.body.code).toBe('NETWORK_LIST_HIDDEN');
    await kofi.agent.get('/v1/network/members/kofi-mensah/connections').expect(200);
    const relationship = await ama.agent
      .get('/v1/network/members/kofi-mensah/relationship')
      .expect(200);
    expect(relationship.body.counts).toBeNull();

    await kofi.agent
      .patch('/v1/me/profile/visibility')
      .send({ networkLists: 'public', publicPageEnabled: true })
      .expect(200);
    const publicList = await browser(app)
      .get('/v1/public/network/members/kofi-mensah/connections')
      .expect(200);
    expect(publicList.headers['cache-control']).toBe('public, max-age=60');
    expect(publicList.body.items).toEqual([
      expect.objectContaining({ member: expect.objectContaining({ handle: 'ama-owusu' }) }),
    ]);
  });

  it('follows an organization through the target registry', async () => {
    const created = await ama.agent
      .post('/v1/organizations')
      .set('Idempotency-Key', 'organization')
      .send({ name: 'Fondation Teranga', structureType: 'foundation', countryCodes: ['SN'] })
      .expect(201);
    const followed = await kofi.agent
      .put(`/v1/network/follows/organization/${created.body.id as string}`)
      .expect(200);
    expect(followed.body.target).toMatchObject({
      type: 'organization',
      key: created.body.id,
      displayName: 'Fondation Teranga',
      subtitle: 'foundation',
    });
    const following = await kofi.agent
      .get('/v1/network/members/kofi-mensah/following?type=organization')
      .expect(200);
    expect(following.body.items).toHaveLength(1);
    const followers = await ama.agent
      .get(`/v1/network/follows/organization/${created.body.id as string}/followers`)
      .expect(200);
    expect(followers.body.items).toEqual([
      expect.objectContaining({ member: expect.objectContaining({ handle: 'kofi-mensah' }) }),
    ]);
    await kofi.agent
      .put('/v1/network/follows/project/0199a1b2-0000-7000-8000-000000000001')
      .expect(404);
  });

  it('records profile views, anonymizes private visits, then purges old views', async () => {
    const maintenance = worker.get(NetworkMaintenanceService);
    // The Redis buffer is shared by the test files: views left by other files are dropped.
    await maintenance.flushProfileViews();
    await query('DELETE FROM network.profile_views');
    const awa = await member('awa@example.com', 'Awa Ndiaye');
    await awa.agent
      .post('/v1/me/profile/entrepreneur-facet')
      .set('Idempotency-Key', 'facet-awa')
      .send(ENTREPRENEUR)
      .expect(201);
    await awa.agent
      .patch('/v1/me/network/settings')
      .send({ privateProfileViews: true })
      .expect(200);

    await ama.agent.get('/v1/profiles/kofi-mensah').expect(200);
    await ama.agent.get('/v1/profiles/kofi-mensah').expect(200);
    await awa.agent.get('/v1/profiles/kofi-mensah').expect(200);
    await kofi.agent.get('/v1/profiles/kofi-mensah').expect(200);

    await vi.waitFor(
      async () => {
        await maintenance.flushProfileViews();
        const summary = await kofi.agent.get('/v1/me/profile-views/summary').expect(200);
        expect(summary.body).toEqual({
          last7Days: 2,
          last30Days: 2,
          last90Days: 2,
          retentionDays: 90,
        });
      },
      { timeout: 10_000, interval: 100 },
    );
    const visits = await kofi.agent.get('/v1/me/profile-views').expect(200);
    expect(visits.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          visitor: expect.objectContaining({ handle: 'ama-owusu' }),
          anonymous: null,
        }),
        {
          day: expect.any(String),
          visitor: null,
          anonymous: { sectorCode: 'agriculture_forestry_fishing' },
        },
      ]),
    );
    expect(JSON.stringify(visits.body)).not.toContain('awa-ndiaye');

    await query(`UPDATE network.profile_views SET day = current_date - 120`);
    expect(await maintenance.purgeProfileViews()).toBe(2);
    const purged = await kofi.agent.get('/v1/me/profile-views/summary').expect(200);
    expect(purged.body.last90Days).toBe(0);
  });
});
