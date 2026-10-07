import { createDatabase } from '@pitchorium/db';
import { inject } from 'vitest';

const PLATFORM_TABLES = ['outbox_events', 'inbox_messages', 'idempotency_keys', 'audit_log'];

export async function truncatePlatformTables(): Promise<void> {
  const { pool } = createDatabase({ url: inject('databaseUrl'), maxConnections: 1 });
  try {
    await pool.query(`TRUNCATE ${PLATFORM_TABLES.map((table) => `platform.${table}`).join(', ')}`);
  } finally {
    await pool.end();
  }
}
