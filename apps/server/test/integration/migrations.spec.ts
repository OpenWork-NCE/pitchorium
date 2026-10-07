import { createDatabase, runMigrations } from '@pitchorium/db';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

const BUSINESS_SCHEMAS = [
  'identity',
  'access',
  'profiles',
  'organizations',
  'media',
  'network',
  'content',
  'projects',
  'impact',
  'payments',
  'engagement',
  'messaging',
  'notifications',
  'discovery',
  'events',
  'missions',
  'trust',
  'privacy',
  'localization',
  'admin',
];

async function adminQuery(sql: string): Promise<void> {
  const { pool } = createDatabase({ url: inject('postgresAdminUrl'), maxConnections: 1 });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

describe('migrations', () => {
  const blankDatabase = 'migrations_blank';
  let url: string;

  beforeAll(async () => {
    await adminQuery(`CREATE DATABASE ${blankDatabase}`);
    url = inject('databaseUrl').replace(/\/pitchorium$/, `/${blankDatabase}`);
  });

  afterAll(async () => {
    await adminQuery(`DROP DATABASE ${blankDatabase} WITH (FORCE)`);
  });

  it('builds the whole schema on a blank database and can be re-run', async () => {
    await runMigrations(url);
    await runMigrations(url);

    const { pool } = createDatabase({ url, maxConnections: 1 });
    try {
      const schemas = await pool.query<{ name: string }>(
        `SELECT schema_name AS name FROM information_schema.schemata`,
      );
      const tables = await pool.query<{ name: string }>(
        `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'platform' ORDER BY 1`,
      );
      const extensions = await pool.query<{ name: string }>(
        `SELECT extname AS name FROM pg_extension`,
      );

      expect(schemas.rows.map((row) => row.name)).toEqual(
        expect.arrayContaining(['platform', ...BUSINESS_SCHEMAS]),
      );
      expect(tables.rows.map((row) => row.name)).toEqual([
        'audit_log',
        'feature_flags',
        'idempotency_keys',
        'inbox_messages',
        'outbox_events',
      ]);
      expect(extensions.rows.map((row) => row.name)).toEqual(
        expect.arrayContaining(['pg_trgm', 'unaccent', 'citext']),
      );
    } finally {
      await pool.end();
    }
  });
});
