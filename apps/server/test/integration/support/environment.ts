import { inject } from 'vitest';

export const TEST_WEB_APP_URL = 'http://web.pitchorium.test';
export const TEST_API_URL = 'http://api.pitchorium.test';
export const TEST_LEGAL_VERSION = 'test-2026-10';

/**
 * Environment shared by the integration tests: real Postgres, Valkey, Mailpit and MinIO (the
 * api tests replace storage by a fake unless they ask for MinIO); OAuth providers are served by
 * FakeOAuthProviders.
 */
export function useTestEnvironment(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: inject('databaseUrl'),
    REDIS_URL: inject('redisUrl'),
    QUEUE_PREFIX: `test-${process.pid}`,
    S3_ENDPOINT: inject('minioEndpoint'),
    S3_FORCE_PATH_STYLE: 'true',
    S3_ACCESS_KEY_ID: 'pitchorium',
    S3_SECRET_ACCESS_KEY: 'pitchorium-secret',
    S3_BUCKET_PUBLIC: 'test-public',
    S3_BUCKET_PRIVATE: 'test-private',
    S3_PUBLIC_BASE_URL: `${inject('minioEndpoint')}/test-public`,
    MAIL_TRANSPORT: 'smtp',
    MAIL_FROM: 'Pitchorium <test@pitchorium.invalid>',
    SMTP_URL: inject('mailpitSmtpUrl'),
    RATE_LIMIT_MAX: '1000',
    WEB_APP_URL: TEST_WEB_APP_URL,
    API_PUBLIC_URL: TEST_API_URL,
    CORS_ORIGINS: TEST_WEB_APP_URL,
    LEGAL_TERMS_VERSION: TEST_LEGAL_VERSION,
    LEGAL_PRIVACY_VERSION: TEST_LEGAL_VERSION,
    AUTH_SECRET: 'integration-tests-secret-with-at-least-32-chars',
    AUTH_RATE_LIMIT_MAX: '1000',
    AUTH_PWNED_PASSWORD_CHECK: 'false',
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    LINKEDIN_CLIENT_ID: 'linkedin-client',
    LINKEDIN_CLIENT_SECRET: 'linkedin-secret',
    MICROSOFT_CLIENT_ID: 'microsoft-client',
    MICROSOFT_CLIENT_SECRET: 'microsoft-secret',
    // Unset unless a test asks for short intervals: scheduled tasks keep their cron pattern.
    SCHEDULED_TASKS_EVERY_MS: '',
    ...overrides,
  });
}
