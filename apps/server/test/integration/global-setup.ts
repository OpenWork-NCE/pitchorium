import { createDatabase, runMigrations, seedFeatureFlags, seedReferenceData } from '@pitchorium/db';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

export const POSTGRES_IMAGE = 'postgres:17.11-alpine';
const VALKEY_IMAGE = 'valkey/valkey:9.0.6-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit:v1.31.4';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    postgresAdminUrl: string;
    mailpitSmtpUrl: string;
    mailpitApiUrl: string;
  }
}

/** Starts one Postgres, one Valkey and one Mailpit for the whole integration run. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis, mailpit]: [
    StartedPostgreSqlContainer,
    StartedRedisContainer,
    StartedTestContainer,
  ] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('pitchorium').start(),
    new RedisContainer(VALKEY_IMAGE).start(),
    new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/readyz', 8025))
      .start(),
  ]);
  const databaseUrl = postgres.getConnectionUri();
  await runMigrations(databaseUrl);
  const { db, pool } = createDatabase({ url: databaseUrl, maxConnections: 1 });
  try {
    await seedFeatureFlags(db);
    await seedReferenceData(db);
  } finally {
    await pool.end();
  }

  project.provide('databaseUrl', databaseUrl);
  project.provide('postgresAdminUrl', databaseUrl.replace(/\/pitchorium$/, '/postgres'));
  project.provide('redisUrl', redis.getConnectionUrl());
  const mailpitHost = mailpit.getHost();
  project.provide('mailpitSmtpUrl', `smtp://${mailpitHost}:${mailpit.getMappedPort(1025)}`);
  project.provide('mailpitApiUrl', `http://${mailpitHost}:${mailpit.getMappedPort(8025)}`);

  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), mailpit.stop()]);
  };
}
