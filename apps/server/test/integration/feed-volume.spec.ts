import type { NestExpressApplication } from '@nestjs/platform-express';
import { type Database } from '@pitchorium/db';
import { sql, type SQL } from '@pitchorium/db/orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentRepository } from '../../src/modules/content/application/ports';
import { DATABASE } from '../../src/platform/database';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { createMember, type Member } from './support/members';

const MEMBERS = 1000;
const POSTS_PER_MEMBER = 50;
const FOLLOWED = 200;
/** Upper bound checked on CI runners; the measured median is documented in ADR 0032. */
const MAX_MEDIAN_MS = 500;

/** A UUIDv7 built in SQL (PostgreSQL 17 has no uuidv7()): timestamp, version 7, variant. */
const UUID_V7 = (
  timestamp: string,
) => `(lpad(to_hex((extract(epoch from ${timestamp}) * 1000)::bigint), 12, '0')
  || '7' || substr(md5(random()::text), 1, 3) || '8' || substr(md5(random()::text), 1, 15))::uuid`;

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

/** Fan-out on read on a realistic volume (ADR 0032): index use and response time. */
describe('feed volume', () => {
  let app: NestExpressApplication;
  let reader: Member;

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    await truncateAllTables();
    reader = await createMember(app, 'reader@example.com', { name: 'Reader' });
    await reader.agent.get('/v1/me/profile').expect(200);
    await query(
      `INSERT INTO profiles.profiles (user_id, handle, display_name, languages, public_page_enabled,
         entrepreneur_details_visibility, contributor_details_visibility, network_lists_visibility,
         created_at, updated_at)
       SELECT ${UUID_V7('now()')}, 'member-' || g, 'Member ' || g, '{}', false,
         'members', 'members', 'members', now(), now()
       FROM generate_series(1, $1::int) g`,
      [MEMBERS],
    );
    await query(
      `INSERT INTO network.follows (follower_id, target_type, target_id, origin, created_at)
       SELECT $1, 'member', user_id, 'manual', now()
       FROM profiles.profiles WHERE handle LIKE 'member-%' ORDER BY handle LIMIT $2`,
      [reader.userId, FOLLOWED],
    );
    await query(
      `INSERT INTO content.posts (id, author_id, kind, text, language_source, visibility,
         image_media_ids, comments_disabled, moderation_status, created_at)
       SELECT ${UUID_V7('created')}, p.user_id, 'post', 'Publication ' || n, 'undetermined',
         CASE WHEN n % 10 = 0 THEN 'connections' ELSE 'members' END, '{}', false, 'visible', created
       FROM profiles.profiles p CROSS JOIN generate_series(1, $1::int) n
       CROSS JOIN LATERAL (SELECT now() - random() * interval '90 days' + n * interval '0 s' AS created) t
       WHERE p.handle LIKE 'member-%'`,
      [POSTS_PER_MEMBER],
    );
    await query('ANALYZE content.posts');
    await query('ANALYZE network.follows');
  }, 300_000);

  afterAll(async () => {
    await app.close();
  });

  it('holds the expected volume', async () => {
    const [counts] = await query<{ posts: string; members: string; followed: string }>(
      `SELECT (SELECT count(*) FROM content.posts) AS posts,
              (SELECT count(*) FROM profiles.profiles) AS members,
              (SELECT count(*) FROM network.follows WHERE follower_id = $1) AS followed`,
      [reader.userId],
    );
    expect(counts).toEqual({
      posts: String(MEMBERS * POSTS_PER_MEMBER),
      members: String(MEMBERS + 1),
      followed: String(FOLLOWED),
    });
  });

  it('reads the feed through the partial feed index, without scanning the publications', async () => {
    const db = app.get<Database>(DATABASE);
    const followed = await query<{ target_id: string }>(
      'SELECT target_id FROM network.follows WHERE follower_id = $1',
      [reader.userId],
    );
    const execute = vi.spyOn(db, 'execute');
    await app.get(ContentRepository).networkFeed(
      {
        viewerId: reader.userId,
        memberAuthorIds: [reader.userId, ...followed.map((row) => row.target_id)],
        organizationIds: [],
        connectionAuthorIds: [reader.userId],
        blockedUserIds: [],
      },
      null,
      21,
    );
    const feedQuery = execute.mock.calls.at(-1)?.[0] as SQL;
    execute.mockRestore();
    const result = await db.execute<{
      'QUERY PLAN': [{ Plan: PlanNode; 'Execution Time': number }];
    }>(sql`explain (analyze, format json) ${feedQuery}`);
    const explained = result.rows[0]?.['QUERY PLAN'][0];
    const plan = nodes(explained?.Plan as PlanNode);
    const postScans = plan.filter((node) => node['Relation Name'] === 'posts');
    expect(postScans.length).toBeGreaterThan(0);
    expect(postScans.every((node) => node['Index Name'] === 'posts_member_feed_idx')).toBe(true);
    expect(
      plan.some((node) => node['Node Type'] === 'Seq Scan' && node['Relation Name'] === 'posts'),
    ).toBe(false);
    process.stdout.write(`feed query execution: ${explained?.['Execution Time'].toFixed(1)} ms\n`);
  });

  it(`answers GET /v1/feed with a median under ${MAX_MEDIAN_MS} ms`, async () => {
    await reader.agent.get('/v1/feed').expect(200);
    const durations: number[] = [];
    for (let run = 0; run < 7; run += 1) {
      const started = performance.now();
      const response = await reader.agent.get('/v1/feed?limit=20').expect(200);
      durations.push(performance.now() - started);
      expect(response.body.items).toHaveLength(20);
    }
    const median = durations.sort((a, b) => a - b)[3] ?? Infinity;
    process.stdout.write(`GET /v1/feed median: ${median.toFixed(1)} ms\n`);
    expect(median).toBeLessThan(MAX_MEDIAN_MS);
  });
});
