import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DatabaseHandle } from '@pitchorium/db';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MatchingService } from '../../src/modules/discovery/application/matching.service';
import { DATABASE_HANDLE } from '../../src/platform/database';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { createMember, type Member } from './support/members';
import { handleOf } from './support/messaging';

const MEMBERS = 5000;
const PROJECTS = 2000;
const EVENTS = 500;
const MISSIONS = 500;
const ORGANIZATIONS = 300;
/**
 * Bounds checked on CI runners; the medians measured on a development machine are written in
 * ADR 0066 and 0068.
 */
const MAX_SEARCH_MEDIAN_MS = 500;
const MAX_SUGGESTIONS_MS = 3000;

interface PlanNode {
  'Node Type': string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

const COUNTRIES = [
  'SN',
  'CI',
  'GH',
  'NG',
  'KE',
  'CM',
  'BJ',
  'TG',
  'ML',
  'BF',
  'RW',
  'HT',
  'JM',
  'MA',
];
const SECTORS = [
  'agriculture_forestry_fishing',
  'manufacturing',
  'energy_supply',
  'information_communication',
  'education',
  'human_health_social_work',
  'financial_insurance',
  'transportation_storage',
];
const FIRST = [
  'Amina',
  'Kofi',
  'Fatou',
  'Awa',
  'Moussa',
  'Aissatou',
  'Yaw',
  'Ngozi',
  'Kwame',
  'Esi',
];
const LAST = ['Diallo', 'Mensah', 'Sow', 'Ndiaye', 'Traoré', 'Okafor', 'Boateng', 'Kamara', 'Diop'];
const WORDS = ['irrigation', 'solaire', 'cacao', 'mangue', 'textile', 'santé', 'école', 'fintech'];

/** Array literal of a list of codes, for the SQL of the fixtures. */
const array = (values: readonly string[]) => `ARRAY[${values.map((v) => `'${v}'`).join(',')}]`;
const pick = (values: readonly string[], n: string) =>
  `(${array(values)})[1 + (${n} % ${values.length})]`;
const vector = (name: string, subtitle: string, body: string) =>
  `setweight(to_tsvector('simple', lower(unaccent(${name}))), 'A') ||
   setweight(to_tsvector('simple', lower(unaccent(${subtitle}))), 'B') ||
   setweight(to_tsvector('simple', lower(unaccent(${body}))), 'C')`;

/**
 * Search and suggestions on a realistic volume of the projection (ADR 0066, 0068): plans read
 * with EXPLAIN on the queries the repository really sends, response and computation times.
 */
describe('discovery volume', () => {
  let app: NestExpressApplication;
  let viewer: Member;
  let sent: { text: string; values: unknown[] }[] = [];

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    await truncateAllTables();
    viewer = await createMember(app, 'viewer@example.com', { name: 'Fatou Sow' });
    await handleOf(viewer);
    await query(
      `INSERT INTO discovery.search_documents (kind, entity_id, audience, key, owner_id, name,
         name_normalized, subtitle, document, country_codes, sector_codes, tags, fingerprint, indexed_at)
       SELECT 'person', id, audience, 'member-' || g, id, name, lower(unaccent(name)), 'Mentor',
         ${vector('name', "'Mentor'", "'Accompagnement des entrepreneurs'")},
         ARRAY[${pick(COUNTRIES, 'g')}], ARRAY[${pick(SECTORS, 'g')}],
         ARRAY['facet:contributor', 'hat:' || ${pick(['mentor', 'investor', 'expert'], 'g')}], 'x', now()
       FROM (SELECT g, gen_random_uuid() AS id,
               ${pick(FIRST, 'g')} || ' ' || ${pick(LAST, 'g / 7')} || ' ' || g AS name
             FROM generate_series(1, $1::int) g) m
       CROSS JOIN (VALUES ('members'), ('public')) a(audience)`,
      [MEMBERS],
    );
    await query(
      `INSERT INTO discovery.match_profiles (user_id, display_name, residence_country, languages,
         has_entrepreneur, entrepreneur_visibility, company_country, entrepreneur_sector, needs,
         has_contributor, contributor_visibility, hats, intervention_countries, contributor_sectors,
         ticket_min_minor, ticket_max_minor, ticket_currency, instruments, mentoring_available, updated_at)
       SELECT entity_id, name, 'FR', ARRAY['fr'], g % 2 = 0, 'members',
         ${pick(COUNTRIES, 'g')}, ${pick(SECTORS, 'g')}, ARRAY['funding'],
         true, 'members', ARRAY[${pick(['mentor', 'investor', 'expert'], 'g')}],
         ARRAY[${pick(COUNTRIES, 'g / 3')}], ARRAY[${pick(SECTORS, 'g / 5')}],
         100000, 10000000, 'EUR', ARRAY['donation'], g % 4 = 0, now() - g * interval '1 minute'
       FROM (SELECT entity_id, name, row_number() OVER () AS g FROM discovery.search_documents
             WHERE kind = 'person' AND audience = 'members') p`,
    );
    // Each kind with the attributes its cards read (statuses, tags).
    for (const [kind, count, status, tags] of [
      ['project', PROJECTS, `'funding'`, ['instrument:donation']],
      ['event', EVENTS, `'published'`, ['format:online', 'lang:fr', 'tz:Africa/Dakar']],
      [
        'mission',
        MISSIONS,
        `'open'`,
        ['direction:offer', 'kind:mentoring', 'mode:remote', 'lang:fr'],
      ],
      ['organization', ORGANIZATIONS, 'NULL', ['structure:foundation']],
    ] as const) {
      await query(
        `INSERT INTO discovery.search_documents (kind, entity_id, audience, key, owner_id, name,
           name_normalized, subtitle, document, country_codes, sector_codes, tags, status,
           starts_at, ends_at, published_at, fingerprint, indexed_at)
         SELECT '${kind}', id, audience, '${kind}-' || g, NULL, name, lower(unaccent(name)), 'Résumé',
           ${vector('name', "'Résumé'", "'Une description du ' || name")},
           ARRAY[${pick(COUNTRIES, 'g')}], ARRAY[${pick(SECTORS, 'g')}], ${array(tags)}, ${status},
           now() + g * interval '1 hour', now() + (g + 2) * interval '1 hour',
           now() - g * interval '1 minute', 'x', now()
         FROM (SELECT g, gen_random_uuid() AS id,
                 initcap('${kind}') || ' ' || ${pick(WORDS, 'g')} || ' ' || g AS name
               FROM generate_series(1, $1::int) g) e
         CROSS JOIN (VALUES ('members'), ('public')) a(audience)`,
        [count],
      );
    }
    await query(
      `INSERT INTO discovery.match_profiles (user_id, display_name, residence_country, languages,
         has_entrepreneur, entrepreneur_visibility, company_country, entrepreneur_sector, needs,
         has_contributor, contributor_visibility, hats, intervention_countries, contributor_sectors,
         instruments, mentoring_available, updated_at)
       VALUES ($1, 'Fatou Sow', 'FR', ARRAY['fr'], true, 'members', 'SN',
         'agriculture_forestry_fishing', ARRAY['mentoring', 'funding'], true, 'members',
         ARRAY['investor'], ARRAY['SN'], ARRAY['agriculture_forestry_fishing'], ARRAY['donation'],
         false, now())`,
      [viewer.userId],
    );
    await query('ANALYZE discovery.search_documents');
    await query('ANALYZE discovery.match_profiles');

    // Every SQL statement sent by the application, to read its plan.
    const { pool } = app.get<DatabaseHandle>(DATABASE_HANDLE);
    const client = await pool.connect();
    const prototype = Object.getPrototypeOf(client) as {
      query: (...args: unknown[]) => unknown;
    };
    client.release();
    const original = prototype.query;
    vi.spyOn(prototype, 'query').mockImplementation(function (this: unknown, ...args: unknown[]) {
      const [config, values] = args;
      if (typeof config === 'string')
        sent.push({ text: config, values: (values as unknown[]) ?? [] });
      else if (config && typeof config === 'object' && 'text' in config) {
        const typed = config as { text: string; values?: unknown[] };
        // drizzle passes the parameters apart from the configuration object.
        sent.push({
          text: typed.text,
          values: typed.values ?? (Array.isArray(values) ? (values as unknown[]) : []),
        });
      }
      return original.apply(this, args);
    });
  }, 600_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  /** EXPLAIN ANALYZE of the last statement sent on a table, with its parameters. */
  const explain = async (
    table: string,
    options: { threshold?: boolean; noSeqScan?: boolean } = {},
  ) => {
    const statement = [...sent]
      .reverse()
      .find(
        (item) => item.text.includes(`"discovery"."${table}"`) && item.text.startsWith('select'),
      );
    expect(statement, table).toBeDefined();
    const { pool } = app.get<DatabaseHandle>(DATABASE_HANDLE);
    const client = await pool.connect();
    try {
      if (options.threshold) await client.query(`SET pg_trgm.word_similarity_threshold = 0.5`);
      const result = await client.query<{
        'QUERY PLAN': [{ Plan: PlanNode; 'Execution Time': number }];
      }>(`EXPLAIN (ANALYZE, FORMAT JSON) ${statement!.text}`, statement!.values);
      const explained = result.rows[0]!['QUERY PLAN'][0];
      return { plan: nodes(explained.Plan), time: explained['Execution Time'] };
    } finally {
      client.release();
    }
  };

  /** Plan of a statement of the test, sequential scans disabled to show the usable indexes. */
  const explainSql = async (statement: string) => {
    const { pool } = app.get<DatabaseHandle>(DATABASE_HANDLE);
    const client = await pool.connect();
    try {
      await client.query('SET pg_trgm.word_similarity_threshold = 0.5');
      await client.query('SET enable_seqscan = off');
      const result = await client.query<{ 'QUERY PLAN': [{ Plan: PlanNode }] }>(
        `EXPLAIN (FORMAT JSON) ${statement}`,
      );
      return { plan: nodes(result.rows[0]!['QUERY PLAN'][0].Plan) };
    } finally {
      client.release();
    }
  };

  it(`searches a typo through the indexes, with a median under ${MAX_SEARCH_MEDIAN_MS} ms`, async () => {
    sent = [];
    const durations: number[] = [];
    for (let run = 0; run < 7; run += 1) {
      const started = performance.now();
      const response = await viewer.agent.get('/v1/discovery/search?q=irigation&limit=20');
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      durations.push(performance.now() - started);
      expect(response.body.items.length).toBeGreaterThan(0);
    }
    const median = durations.sort((a, b) => a - b)[3] ?? Infinity;
    // The plan the planner chooses at this volume is logged: a sequential scan or the B-tree of
    // the audience can be cheaper than the GIN indexes on a small table.
    const { plan, time } = await explain('search_documents', { threshold: true });
    const indexable = await explainSql(
      `SELECT entity_id FROM discovery.search_documents WHERE document @@ to_tsquery('simple', 'irigation:*')
       UNION ALL
       SELECT entity_id FROM discovery.search_documents WHERE 'irigation'::text <% name_normalized`,
    );
    const indexes = indexable.plan.flatMap((node) =>
      node['Index Name'] ? [node['Index Name']] : [],
    );
    process.stdout.write(
      `search: median ${median.toFixed(1)} ms, query ${time.toFixed(1)} ms, plan ${plan.map((node) => `${node['Node Type']}(${node['Relation Name'] ?? ''})`).join(' > ')}, indexes without sequential scan ${[...new Set(indexes)].join(', ')}\n`,
    );
    // Each text predicate can go through its GIN index (text, trigrams of the names): as the
    // projection grows, the planner switches to them without a change of the query. At this
    // volume, it may read the whole projection faster.
    expect(indexes).toEqual(
      expect.arrayContaining(['search_documents_document_idx', 'search_documents_name_trgm_idx']),
    );
    expect(time).toBeLessThan(MAX_SEARCH_MEDIAN_MS);
    expect(median).toBeLessThan(MAX_SEARCH_MEDIAN_MS);
  });

  it(`computes the suggestions of a member from capped indexed candidates under ${MAX_SUGGESTIONS_MS} ms`, async () => {
    sent = [];
    const started = performance.now();
    await app.get(MatchingService, { strict: false }).recomputeMember(viewer.userId);
    const duration = performance.now() - started;
    const [stored] = await query<{ lists: string; rows: string }>(
      `SELECT count(DISTINCT list) AS lists, count(*) AS rows FROM discovery.suggestions WHERE subject_id = $1`,
      [viewer.userId],
    );
    const { plan, time } = await explain('match_profiles');
    const indexes = plan.flatMap((node) => (node['Index Name'] ? [node['Index Name']] : []));
    process.stdout.write(
      `suggestions: ${duration.toFixed(0)} ms for ${stored?.rows} suggestions in ${stored?.lists} lists, candidates query ${time.toFixed(1)} ms, plan ${plan.map((node) => node['Node Type']).join(' > ')}, indexes ${[...new Set(indexes)].join(', ')}\n`,
    );
    // Capped candidates: the query stops at CANDIDATE_CAP rows.
    expect(plan[0]?.['Node Type']).toBe('Limit');
    expect(Number(stored?.rows)).toBeGreaterThan(0);
    expect(duration).toBeLessThan(MAX_SUGGESTIONS_MS);
  });
});
