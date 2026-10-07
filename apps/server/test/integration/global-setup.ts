import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from '@aws-sdk/client-s3';
import { createDatabase, runMigrations, seedFeatureFlags, seedReferenceData } from '@pitchorium/db';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { TestProject } from 'vitest/node';

export const POSTGRES_IMAGE = 'postgres:17.11-alpine';
const VALKEY_IMAGE = 'valkey/valkey:9.0.6-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit:v1.31.4';
const MINIO_IMAGE = 'pgsty/minio:RELEASE.2026-08-04T00-00-00Z';
export const MINIO_USER = 'pitchorium';
export const MINIO_PASSWORD = 'pitchorium-secret';
export const TEST_BUCKETS = { public: 'test-public', private: 'test-private' } as const;

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
    postgresAdminUrl: string;
    mailpitSmtpUrl: string;
    mailpitApiUrl: string;
    minioEndpoint: string;
  }
}

/** Creates the two buckets; the public one is readable anonymously, like the CDN bucket. */
async function createBuckets(endpoint: string): Promise<void> {
  const client = new S3Client({
    endpoint,
    region: 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: MINIO_USER, secretAccessKey: MINIO_PASSWORD },
  });
  try {
    for (const bucket of Object.values(TEST_BUCKETS)) {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    await client.send(
      new PutBucketPolicyCommand({
        Bucket: TEST_BUCKETS.public,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${TEST_BUCKETS.public}/*`],
            },
          ],
        }),
      }),
    );
  } finally {
    client.destroy();
  }
}

/** Starts one Postgres, one Valkey, one Mailpit and one MinIO for the whole integration run. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const [postgres, redis, mailpit, minio]: [
    StartedPostgreSqlContainer,
    StartedRedisContainer,
    StartedTestContainer,
    StartedTestContainer,
  ] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withDatabase('pitchorium').start(),
    new RedisContainer(VALKEY_IMAGE).start(),
    new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/readyz', 8025))
      .start(),
    new GenericContainer(MINIO_IMAGE)
      .withCommand(['server', '/data'])
      .withEnvironment({ MINIO_ROOT_USER: MINIO_USER, MINIO_ROOT_PASSWORD: MINIO_PASSWORD })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
      .start(),
  ]);
  const minioEndpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
  await createBuckets(minioEndpoint);
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
  project.provide('minioEndpoint', minioEndpoint);

  return async () => {
    await Promise.all([postgres.stop(), redis.stop(), mailpit.stop(), minio.stop()]);
  };
}
