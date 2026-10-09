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
  LEGAL_TERMS_VERSION: '2026-10',
  LEGAL_PRIVACY_VERSION: '2026-10',
  AUTH_SECRET: 'a-secret-of-at-least-thirty-two-characters',
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

  /** Production refuses the simulated payment provider and requires Turnstile. */
  const livePayments = {
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    PAYMENTS_MODE: 'live',
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
    EMAIL_LINK_SECRET: 'an-email-link-secret-of-thirty-two-characters',
  };

  it('disables Swagger in production and reads worker settings', () => {
    expect(
      parseApiConfig({ ...baseEnv, ...livePayments, NODE_ENV: 'production' }).http.swaggerEnabled,
    ).toBe(false);
    expect(parseWorkerConfig({ ...baseEnv, OUTBOX_BATCH_SIZE: '50' }).outbox.batchSize).toBe(50);
  });

  it('requires a CDN purge provider in production, and its credentials', () => {
    expect(parseWorkerConfig(baseEnv).cdn).toEqual({ provider: 'none' });
    expect(
      issuesOf(() => parseWorkerConfig({ ...baseEnv, ...livePayments, NODE_ENV: 'production' })),
    ).toEqual(['CDN_PURGE_PROVIDER: A CDN purge provider is required in production']);
    expect(
      issuesOf(() => parseWorkerConfig({ ...baseEnv, CDN_PURGE_PROVIDER: 'cloudflare' })).map(
        (issue) => issue.split(':')[0],
      ),
    ).toEqual(['CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_API_TOKEN']);
    const zoneId = 'a'.repeat(32);
    expect(
      parseWorkerConfig({
        ...baseEnv,
        ...livePayments,
        NODE_ENV: 'production',
        CDN_PURGE_PROVIDER: 'cloudflare',
        CLOUDFLARE_ZONE_ID: zoneId,
        CLOUDFLARE_API_TOKEN: 'token',
      }).cdn,
    ).toEqual({ provider: 'cloudflare', cloudflare: { zoneId, apiToken: 'token' } });
  });

  it('allows the test adapter of the antivirus outside production only', () => {
    expect(parseWorkerConfig(baseEnv).malwareScanner).toBe('clamav');
    expect(parseWorkerConfig({ ...baseEnv, MALWARE_SCANNER: 'eicar-only' }).malwareScanner).toBe(
      'eicar-only',
    );
    expect(
      issuesOf(() =>
        parseWorkerConfig({
          ...baseEnv,
          ...livePayments,
          NODE_ENV: 'production',
          CDN_PURGE_PROVIDER: 'cloudflare',
          CLOUDFLARE_ZONE_ID: 'a'.repeat(32),
          CLOUDFLARE_API_TOKEN: 'token',
          MALWARE_SCANNER: 'eicar-only',
        }),
      ),
    ).toEqual(['MALWARE_SCANNER: Only ClamAV is allowed in production']);
  });

  it('refuses the development secret of the email links in production', () => {
    const { EMAIL_LINK_SECRET: _secret, ...withoutSecret } = livePayments;
    expect(
      issuesOf(() => parseApiConfig({ ...baseEnv, ...withoutSecret, NODE_ENV: 'production' })),
    ).toEqual(['EMAIL_LINK_SECRET: Set a secret of at least 32 characters in production']);
  });

  it('refuses the simulated payment provider in production and incomplete credentials', () => {
    expect(parseApiConfig(baseEnv).payments).toMatchObject({
      mode: 'simulated',
      stripe: undefined,
      commission: { rateBps: 500 },
      minEurMinor: 100n,
    });
    expect(
      issuesOf(() =>
        parseApiConfig({
          ...baseEnv,
          EMAIL_LINK_SECRET: livePayments.EMAIL_LINK_SECRET,
          TURNSTILE_SITE_KEY: livePayments.TURNSTILE_SITE_KEY,
          TURNSTILE_SECRET_KEY: livePayments.TURNSTILE_SECRET_KEY,
          NODE_ENV: 'production',
        }),
      ),
    ).toEqual(['PAYMENTS_MODE: The simulated payment provider is refused in production']);
    expect(issuesOf(() => parseApiConfig({ ...baseEnv, PAYMENTS_MODE: 'live' }))).toEqual([
      'PAYMENTS_MODE: PAYMENTS_MODE=live requires the Stripe or Flutterwave credentials',
    ]);
    expect(
      issuesOf(() => parseApiConfig({ ...baseEnv, FLUTTERWAVE_SECRET_KEY: 'FLWSECK_TEST-x' })),
    ).toEqual([
      'FLUTTERWAVE_WEBHOOK_SECRET_HASH: Set both FLUTTERWAVE_SECRET_KEY and FLUTTERWAVE_WEBHOOK_SECRET_HASH, or neither',
    ]);
    expect(parseApiConfig({ ...baseEnv, ...livePayments }).payments.stripe).toEqual({
      secretKey: 'sk_test_x',
      webhookSecret: 'whsec_x',
      apiBaseUrl: 'https://api.stripe.com',
    });
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

  it('enables Turnstile with both keys, and requires it in production', () => {
    expect(parseApiConfig(baseEnv).auth.turnstile).toBeUndefined();
    expect(
      parseApiConfig({ ...baseEnv, TURNSTILE_SITE_KEY: 'site', TURNSTILE_SECRET_KEY: 'secret' })
        .auth.turnstile,
    ).toEqual({ siteKey: 'site', secretKey: 'secret', appearance: 'interaction-only' });
    expect(issuesOf(() => parseApiConfig({ ...baseEnv, TURNSTILE_SITE_KEY: 'site' }))).toEqual([
      'TURNSTILE_SECRET_KEY: Set both TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, or neither',
    ]);
    const {
      TURNSTILE_SITE_KEY: _site,
      TURNSTILE_SECRET_KEY: _secret,
      ...withoutTurnstile
    } = livePayments;
    expect(
      issuesOf(() => parseApiConfig({ ...baseEnv, ...withoutTurnstile, NODE_ENV: 'production' })),
    ).toEqual(['TURNSTILE_SECRET_KEY: Cloudflare Turnstile is required in production']);
  });

  it('enables an OAuth provider only with both credentials, and derives auth settings', () => {
    const config = parseApiConfig({
      ...baseEnv,
      API_PUBLIC_URL: 'https://api.pitchorium.example/',
      CORS_ORIGINS: 'https://app.pitchorium.example',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    });
    expect(config.auth.providers).toEqual({
      google: { clientId: 'id', clientSecret: 'secret' },
      linkedin: undefined,
      microsoft: undefined,
    });
    expect(config.auth.trustedOrigins).toEqual(['https://app.pitchorium.example']);
    expect(config.auth.secureCookies).toBe(true);
    expect(config.http.publicUrl).toBe('https://api.pitchorium.example');
    expect(parseApiConfig(baseEnv).auth.secureCookies).toBe(false);

    expect(issuesOf(() => parseApiConfig({ ...baseEnv, LINKEDIN_CLIENT_ID: 'id' }))).toEqual([
      'LINKEDIN_CLIENT_SECRET: Set both LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET, or neither',
    ]);
    expect(issuesOf(() => parseApiConfig({ ...baseEnv, AUTH_SECRET: 'short' }))).toEqual([
      'AUTH_SECRET: Too small: expected string to have >=32 characters',
    ]);
  });
});
