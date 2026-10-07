import { inject } from 'vitest';

/** Environment shared by the integration tests; storage and mail never leave the process. */
export function useTestEnvironment(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: inject('databaseUrl'),
    REDIS_URL: inject('redisUrl'),
    QUEUE_PREFIX: `test-${process.pid}`,
    S3_ENDPOINT: 'http://storage.invalid',
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'test',
    S3_BUCKET_PUBLIC: 'test-public',
    S3_BUCKET_PRIVATE: 'test-private',
    S3_PUBLIC_BASE_URL: 'http://storage.invalid/test-public',
    MAIL_TRANSPORT: 'smtp',
    MAIL_FROM: 'Pitchorium <test@pitchorium.invalid>',
    SMTP_URL: 'smtp://mail.invalid:1025',
    RATE_LIMIT_MAX: '1000',
    ...overrides,
  });
}
