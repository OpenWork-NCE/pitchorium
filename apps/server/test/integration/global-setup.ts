import { runMigrations } from '@pitchorium/db';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import type { TestProject } from 'vitest/node';

export const POSTGRES_IMAGE = 'postgres:17.11-alpine';
const VALKEY_IMAGE = 'valkey/valkey:9.0.6-alpine';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    postgresAdminUrl: string;
  }
}

/** Starts one Postgres and one Valkey for the whole integration run. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis]: [StartedPostgreSqlContainer, StartedRedisContainer] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('pitchorium').start(),
    new RedisContainer(VALKEY_IMAGE).start(),
  ]);
  const databaseUrl = postgres.getConnectionUri();
  await runMigrations(databaseUrl);

  project.provide('databaseUrl', databaseUrl);
  project.provide('postgresAdminUrl', databaseUrl.replace(/\/pitchorium$/, '/postgres'));
  project.provide('redisUrl', redis.getConnectionUrl());

  return async () => {
    await Promise.all([postgres.stop(), redis.stop()]);
  };
}
