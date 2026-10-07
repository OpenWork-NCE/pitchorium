import { spawnSync } from 'node:child_process';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createDatabase, type DatabaseHandle } from '@pitchorium/db';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { parseWorkerConfig } from '../../src/platform/config';
import { SystemClock } from '../../src/platform/kernel';
import { S3ObjectStorage } from '../../src/platform/storage/s3-object-storage';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  type DevSeedResult,
  seedDevData,
} from '../../scripts/dev-seed/seed-dev-data';
import { createSeedContext, seedDevProjects } from '../../scripts/dev-seed/seed-dev-projects';
import { MethodologiesService } from '../../src/modules/impact/application/methodologies.service';
import { FixedClock } from '../../src/platform/kernel';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_LEGAL_VERSION } from './support/environment';
import { browser, signIn } from './support/members';

const COUNTED_TABLES = [
  'identity.users',
  'profiles.profiles',
  'organizations.organizations',
  'media.assets',
  'network.connections',
  'network.follows',
  'content.posts',
  'content.comments',
  'content.reactions',
  'impact.methodologies',
  'impact.assessments',
  'projects.projects',
  'projects.updates',
  'projects.funding_entries',
  'platform.outbox_events',
];

/** pnpm db:seed:dev: demonstration data, idempotent, refused in production. */
describe('development data', () => {
  let app: NestExpressApplication;
  let handle: DatabaseHandle;
  let storage: S3ObjectStorage;

  const counts = async () =>
    Object.fromEntries(
      await Promise.all(
        COUNTED_TABLES.map(async (table) => {
          const [row] = await query<{ count: string }>(`SELECT count(*) FROM ${table}`);
          return [table, Number(row?.count)] as const;
        }),
      ),
    );

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], {}, { storage: 'minio' }));
    await truncateAllTables();
    handle = createDatabase({ url: inject('databaseUrl'), maxConnections: 2 });
    storage = new S3ObjectStorage(parseWorkerConfig(process.env).storage, new SystemClock());
  });

  afterAll(async () => {
    storage.close();
    await handle.pool.end();
    await app.close();
  });

  it('inserts the data once, then nothing on a second run', async () => {
    const options = {
      db: handle.db,
      storage,
      legal: { termsVersion: TEST_LEGAL_VERSION, privacyVersion: TEST_LEGAL_VERSION },
    };
    const first = await seedDevData(options);
    expect(first).toMatchObject({ members: 14, organizations: 3, posts: 15, comments: 11 });
    expect(first.media).toBeGreaterThan(30);
    const before = await counts();

    expect(await seedDevData(options)).toEqual({
      members: 0,
      organizations: 0,
      media: 0,
      connections: 0,
      follows: 0,
      posts: 0,
      comments: 0,
      reactions: 0,
    } satisfies DevSeedResult);
    expect(await counts()).toEqual(before);

    // Projects, impact and their links go through the services and facades (ADR 0035).
    const clock = new FixedClock(new Date());
    const context = await createSeedContext(clock);
    try {
      expect(await seedDevProjects(context, clock)).toEqual({
        methodologies: 1,
        assessments: 7,
        projects: 8,
        contributions: 11,
        follows: 8,
        posts: 2,
      });
      const statuses = await query<{ status: string; count: string }>(
        'SELECT status, count(*) FROM projects.projects GROUP BY status ORDER BY status',
      );
      expect(statuses.map((row) => [row.status, Number(row.count)])).toEqual([
        ['closed', 2],
        ['draft', 2],
        ['funded', 1],
        ['funding', 3],
      ]);
      const events = await query<{ event_type: string }>(
        `SELECT DISTINCT event_type FROM platform.outbox_events
         WHERE event_type LIKE 'projects.%' OR event_type LIKE 'impact.%' ORDER BY event_type`,
      );
      expect(events.map((event) => event.event_type)).toEqual(
        expect.arrayContaining([
          'impact.methodology.published.v1',
          'projects.project.closed.v1',
          'projects.project.ending-soon.v1',
          'projects.project.funded.v1',
          'projects.tier.unlocked.v1',
          'projects.update.published.v1',
        ]),
      );
      const withProjects = await counts();
      expect(await seedDevProjects(context, clock)).toEqual({
        methodologies: 0,
        assessments: 0,
        projects: 0,
        contributions: 0,
        follows: 0,
        posts: 0,
      });
      expect(await counts()).toEqual(withProjects);
      // ensureDemo is idempotent: it returns the existing DEMO version.
      await expect(
        context.get(MethodologiesService, { strict: false }).ensureDemo({
          name: 'x',
          criteria: [],
        }),
      ).resolves.toMatchObject({ demo: true });
    } finally {
      await context.close();
    }

    // Each image waits in the quarantine for the worker, announced by its event.
    const [asset] = await query<{ id: string; declared_size: number }>(
      `SELECT id, declared_size FROM media.assets WHERE status = 'processing' LIMIT 1`,
    );
    expect(await storage.headObject('private', `quarantine/${asset?.id ?? ''}`)).toMatchObject({
      size: Number(asset?.declared_size),
    });
  });

  it('gives accounts that sign in and a populated network and feed', async () => {
    const agent = browser(app);
    await signIn(agent, `aissatou.ba@${DEMO_EMAIL_DOMAIN}`, DEMO_PASSWORD);
    const me = await agent.get('/v1/me').expect(200);
    expect(me.body).toMatchObject({ profile: expect.objectContaining({ handle: 'aissatou-ba' }) });
    const feed = await agent.get('/v1/feed').expect(200);
    expect(feed.body.items.length).toBeGreaterThan(3);
    const requests = await agent.get('/v1/me/network/connection-requests').expect(200);
    expect(requests.body.items).toEqual([
      expect.objectContaining({ member: expect.objectContaining({ handle: 'moussa-diarra' }) }),
    ]);
    const relationship = await agent
      .get('/v1/network/members/kofi-mensah/relationship')
      .expect(200);
    expect(relationship.body).toMatchObject({ degree: 'first', connection: 'connected' });
    const showcase = await agent.get('/v1/projects').expect(200);
    expect(showcase.body.items.length).toBe(6);
    const mine = await agent.get('/v1/me/projects').expect(200);
    expect(mine.body.items[0]).toMatchObject({
      role: 'owner',
      project: {
        impact: { selfDeclared: true },
        organization: { slug: 'reseau-femmes-entrepreneures-sahel' },
      },
    });
  });

  it('refuses to run in production', () => {
    const run = spawnSync(process.execPath, ['-r', '@swc-node/register', 'scripts/seed-dev.ts'], {
      env: { ...process.env, NODE_ENV: 'production' },
      encoding: 'utf8',
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('refused when NODE_ENV=production');
  });
});
