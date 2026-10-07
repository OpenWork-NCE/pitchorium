import { describe, expect, it } from 'vitest';
import { ConfigValidationError, parseApiConfig, parseWorkerConfig } from './config';

const baseEnv = {
  DATABASE_URL: 'postgres://user:secret-password@localhost:5432/pitchorium',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET_PUBLIC: 'pitchorium-public',
  S3_BUCKET_PRIVATE: 'pitchorium-private',
  S3_PUBLIC_BASE_URL: 'http://localhost:9000/pitchorium-public/',
  MAIL_TRANSPORT: 'smtp',
  MAIL_FROM: 'Pitchorium <no-reply@pitchorium.local>',
  SMTP_URL: 'smtp://localhost:1025',
};

function issuesOf(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof ConfigValidationError) return error.issues;
    throw error;
  }
  throw new Error('Expected a ConfigValidationError');
}

describe('configuration', () => {
  it('applies defaults and derives api settings', () => {
    const config = parseApiConfig({
      ...baseEnv,
      CORS_ORIGINS: 'https://a.example, https://b.example',
    });

    expect(config.env).toBe('development');
    expect(config.http).toMatchObject({ port: 3000, swaggerEnabled: true });
    expect(config.http.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.rateLimit.ttlMs).toBe(60_000);
    expect(config.storage.publicBaseUrl).toBe('http://localhost:9000/pitchorium-public');
    expect(config.mail).toEqual({
      transport: 'smtp',
      from: baseEnv.MAIL_FROM,
      smtpUrl: baseEnv.SMTP_URL,
    });
    expect(config.otel.enabled).toBe(false);
  });

  it('disables Swagger in production and reads worker settings', () => {
    expect(parseApiConfig({ ...baseEnv, NODE_ENV: 'production' }).http.swaggerEnabled).toBe(false);
    expect(parseWorkerConfig({ ...baseEnv, OUTBOX_BATCH_SIZE: '50' }).outbox.batchSize).toBe(50);
  });

  it('treats empty values as unset', () => {
    const config = parseApiConfig({ ...baseEnv, SENTRY_DSN: '', API_PORT: '' });
    expect(config.sentry.dsn).toBeUndefined();
    expect(config.http.port).toBe(3000);
  });

  it('reports every invalid variable by name, never by value', () => {
    const issues = issuesOf(() =>
      parseApiConfig({
        ...baseEnv,
        DATABASE_URL: 'mysql://user:secret-password@db/x',
        API_PORT: 'abc',
        REDIS_URL: undefined,
      }),
    );

    expect(issues.map((issue) => issue.split(':')[0])).toEqual([
      'DATABASE_URL',
      'REDIS_URL',
      'API_PORT',
    ]);
    expect(issues.join('\n')).not.toContain('secret-password');
  });

  it('requires the credentials of the selected mail transport', () => {
    expect(issuesOf(() => parseWorkerConfig({ ...baseEnv, SMTP_URL: undefined }))).toEqual([
      'SMTP_URL: Required when MAIL_TRANSPORT=smtp',
    ]);
    expect(issuesOf(() => parseWorkerConfig({ ...baseEnv, MAIL_TRANSPORT: 'resend' }))).toEqual([
      'RESEND_API_KEY: Required when MAIL_TRANSPORT=resend',
    ]);
    expect(
      parseWorkerConfig({ ...baseEnv, MAIL_TRANSPORT: 'resend', RESEND_API_KEY: 're_x' }).mail,
    ).toMatchObject({ transport: 'resend', resendApiKey: 're_x' });
  });
});
