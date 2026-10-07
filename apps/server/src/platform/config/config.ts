import type { z } from 'zod';
import { apiEnv, type ApiEnv, type CommonEnv, workerEnv, type WorkerEnv } from './env';

export type Environment = CommonEnv['NODE_ENV'];

export interface CommonConfig {
  env: Environment;
  logLevel: CommonEnv['LOG_LEVEL'];
  database: { url: string; poolMax: number };
  redis: { url: string };
  queue: { prefix: string };
  storage: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    buckets: { public: string; private: string };
    publicBaseUrl: string;
  };
  mail:
    | { transport: 'smtp'; from: string; smtpUrl: string }
    | { transport: 'resend'; from: string; resendApiKey: string };
  sentry: { dsn: string | undefined; environment: string };
  otel: { enabled: boolean };
  /** Origin of the web application, used in links sent by email. */
  webAppUrl: string;
  /** Versions in force of the terms of service and the privacy policy. */
  legal: { termsVersion: string; privacyVersion: string };
  network: { profileViewsRetentionDays: number };
}

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface ApiConfig extends CommonConfig {
  http: {
    host: string;
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    swaggerEnabled: boolean;
    /** Public origin of the api, as seen by browsers and OAuth providers. */
    publicUrl: string;
  };
  rateLimit: { ttlMs: number; limit: number };
  idempotency: { ttlMs: number };
  media: {
    uploadUrlTtlSeconds: number;
    downloadUrlTtlSeconds: number;
    quota: { maxFiles: number; maxBytes: number };
    uploadRequestsPerHour: number;
  };
  /** Provisional anti-abuse values (docs/open-questions.md). */
  network: CommonConfig['network'] & {
    connectionRequestsPerWeek: number;
    declineCooldownMs: number;
    requestTtlMs: number;
    /** Mutual connections are counted up to this value, then shown as « cap+ ». */
    mutualConnectionsCap: number;
  };
  content: {
    /** Below this number of network publications, the feed is completed by highlights. */
    feedEditorialThreshold: number;
  };
  organizations: {
    maxCreatedPerUser: number;
    invitationTtlMs: number;
    /** Criteria a verification decision may tick; their list is an open question. */
    verificationCriteria: string[];
  };
  auth: {
    secret: string;
    /** Origins allowed to send cookie-authenticated writes (CSRF protection). */
    trustedOrigins: string[];
    /** Parent domain shared by the web app and the api, for example pitchorium.com. */
    cookieDomain: string | undefined;
    /** Secure cookies everywhere except on a plain-http (local) api. */
    secureCookies: boolean;
    rateLimit: { windowSeconds: number; max: number };
    pwnedPasswordCheck: boolean;
    providers: {
      google: OAuthClientConfig | undefined;
      linkedin: OAuthClientConfig | undefined;
      microsoft: OAuthClientConfig | undefined;
    };
  };
}

export interface WorkerConfig extends CommonConfig {
  worker: { healthPort: number };
  outbox: { pollIntervalMs: number; batchSize: number; maxBackoffMs: number };
  clamav: { host: string; port: number; timeoutMs: number };
  media: { orphanTtlMs: number; importTimeoutMs: number };
  /** Fixed interval replacing the cron pattern of every scheduled task (tests only). */
  scheduledTasks: { everyMs: number | undefined };
  content: { linkPreview: { timeoutMs: number; maxBytes: number } };
}

export class ConfigValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

type RawEnv = Record<string, string | undefined>;

/** Empty values in .env files mean "unset", so that optional variables can stay listed. */
function withoutEmptyValues(env: RawEnv): RawEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

function parse<T>(schema: z.ZodType<T>, env: RawEnv): T {
  const result = schema.safeParse(withoutEmptyValues(env));
  if (!result.success) {
    // Only variable names and rule messages are reported: values may be secrets.
    throw new ConfigValidationError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}

function toCommonConfig(env: CommonEnv): CommonConfig {
  return {
    env: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    database: { url: env.DATABASE_URL, poolMax: env.DATABASE_POOL_MAX },
    redis: { url: env.REDIS_URL },
    queue: { prefix: env.QUEUE_PREFIX },
    storage: {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      buckets: { public: env.S3_BUCKET_PUBLIC, private: env.S3_BUCKET_PRIVATE },
      publicBaseUrl: withoutTrailingSlash(env.S3_PUBLIC_BASE_URL),
    },
    mail:
      env.MAIL_TRANSPORT === 'smtp'
        ? { transport: 'smtp', from: env.MAIL_FROM, smtpUrl: env.SMTP_URL ?? '' }
        : { transport: 'resend', from: env.MAIL_FROM, resendApiKey: env.RESEND_API_KEY ?? '' },
    sentry: { dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV },
    otel: { enabled: env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined },
    webAppUrl: withoutTrailingSlash(env.WEB_APP_URL),
    legal: { termsVersion: env.LEGAL_TERMS_VERSION, privacyVersion: env.LEGAL_PRIVACY_VERSION },
    network: { profileViewsRetentionDays: env.NETWORK_PROFILE_VIEWS_RETENTION_DAYS },
  };
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function oauthClient(
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthClientConfig | undefined {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function parseApiConfig(rawEnv: RawEnv): ApiConfig {
  const env: ApiEnv = parse(apiEnv, rawEnv);
  return {
    ...toCommonConfig(env),
    http: {
      host: env.API_HOST,
      port: env.API_PORT,
      corsOrigins: env.CORS_ORIGINS,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      swaggerEnabled: env.NODE_ENV !== 'production',
      publicUrl: withoutTrailingSlash(env.API_PUBLIC_URL),
    },
    rateLimit: { ttlMs: env.RATE_LIMIT_TTL_SECONDS * 1000, limit: env.RATE_LIMIT_MAX },
    idempotency: { ttlMs: env.IDEMPOTENCY_TTL_HOURS * 3_600_000 },
    media: {
      uploadUrlTtlSeconds: env.MEDIA_UPLOAD_URL_TTL_SECONDS,
      downloadUrlTtlSeconds: env.MEDIA_DOWNLOAD_URL_TTL_SECONDS,
      quota: { maxFiles: env.MEDIA_QUOTA_MAX_FILES, maxBytes: env.MEDIA_QUOTA_MAX_BYTES },
      uploadRequestsPerHour: env.MEDIA_UPLOAD_REQUESTS_PER_HOUR,
    },
    network: {
      profileViewsRetentionDays: env.NETWORK_PROFILE_VIEWS_RETENTION_DAYS,
      connectionRequestsPerWeek: env.NETWORK_CONNECTION_REQUESTS_PER_WEEK,
      declineCooldownMs: env.NETWORK_DECLINE_COOLDOWN_DAYS * 86_400_000,
      requestTtlMs: env.NETWORK_REQUEST_TTL_DAYS * 86_400_000,
      mutualConnectionsCap: env.NETWORK_MUTUAL_CONNECTIONS_CAP,
    },
    content: { feedEditorialThreshold: env.CONTENT_FEED_EDITORIAL_THRESHOLD },
    organizations: {
      maxCreatedPerUser: env.ORGANIZATIONS_MAX_CREATED_PER_USER,
      invitationTtlMs: env.ORGANIZATIONS_INVITATION_TTL_DAYS * 86_400_000,
      verificationCriteria: env.ORGANIZATIONS_VERIFICATION_CRITERIA,
    },
    auth: {
      secret: env.AUTH_SECRET,
      trustedOrigins:
        env.AUTH_TRUSTED_ORIGINS.length > 0 ? env.AUTH_TRUSTED_ORIGINS : env.CORS_ORIGINS,
      cookieDomain: env.AUTH_COOKIE_DOMAIN,
      secureCookies: env.API_PUBLIC_URL.startsWith('https://'),
      rateLimit: {
        windowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        max: env.AUTH_RATE_LIMIT_MAX,
      },
      pwnedPasswordCheck: env.AUTH_PWNED_PASSWORD_CHECK,
      providers: {
        google: oauthClient(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
        linkedin: oauthClient(env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET),
        microsoft: oauthClient(env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET),
      },
    },
  };
}

export function parseWorkerConfig(rawEnv: RawEnv): WorkerConfig {
  const env: WorkerEnv = parse(workerEnv, rawEnv);
  return {
    ...toCommonConfig(env),
    worker: { healthPort: env.WORKER_HEALTH_PORT },
    outbox: {
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      maxBackoffMs: env.OUTBOX_MAX_BACKOFF_MS,
    },
    clamav: { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT, timeoutMs: env.CLAMAV_TIMEOUT_MS },
    media: {
      orphanTtlMs: env.MEDIA_ORPHAN_TTL_HOURS * 3_600_000,
      importTimeoutMs: env.MEDIA_IMPORT_TIMEOUT_MS,
    },
    scheduledTasks: { everyMs: env.SCHEDULED_TASKS_EVERY_MS },
    content: {
      linkPreview: {
        timeoutMs: env.CONTENT_LINK_PREVIEW_TIMEOUT_MS,
        maxBytes: env.CONTENT_LINK_PREVIEW_MAX_BYTES,
      },
    },
  };
}

/** Fail fast: an invalid configuration stops the process before anything connects. */
export function loadConfigOrExit<T>(parser: (env: RawEnv) => T): T {
  try {
    return parser(process.env);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}
