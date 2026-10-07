import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type DatabaseSchema = typeof schema;
export type Database = NodePgDatabase<DatabaseSchema>;

export interface DatabaseOptions {
  url: string;
  maxConnections?: number;
  applicationName?: string;
}

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
}

export function createDatabase(options: DatabaseOptions): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.maxConnections ?? 10,
    application_name: options.applicationName ?? 'pitchorium',
  });
  return { db: drizzle({ client: pool, schema }), pool };
}
