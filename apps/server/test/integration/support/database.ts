import { createDatabase } from '@pitchorium/db';
import { inject } from 'vitest';

const PLATFORM_TABLES = ['outbox_events', 'inbox_messages', 'idempotency_keys', 'audit_log'];

/** Business data written by the tests; reference data and feature flags are seeded once. */
const BUSINESS_TABLES = [
  'organizations.organizations',
  'identity.users',
  'access.role_assignments',
  'profiles.profiles',
  'media.assets',
];

export async function truncatePlatformTables(): Promise<void> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    await pool.query(`TRUNCATE ${PLATFORM_TABLES.map((table) => `platform.${table}`).join(', ')}`);
  } finally {
    await pool.end();
  }
}

export async function truncateAllTables(): Promise<void> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    const tables = [...PLATFORM_TABLES.map((table) => `platform.${table}`), ...BUSINESS_TABLES];
    await pool.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
  } finally {
    await pool.end();
  }
}

/** Direct SQL for assertions on rows the api does not expose. */
export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    return (await pool.query<T>(sql, params)).rows;
  } finally {
    await pool.end();
  }
}
