import type { MessagePolicy } from '@pitchorium/contracts';
import type { z } from 'zod';
import { apiEnv, type ApiEnv, type CommonEnv, workerEnv, type WorkerEnv } from './env';

export type Environment = CommonEnv['NODE_ENV'];

export interface CommonConfig {
  env: Environment;
  /** Age of a session beyond which a sensitive action asks to sign in again. */
  access: { reauthenticationMaxAgeMs: number };
  /** Translation on demand (§8.3); provisional limits, docs/open-questions.md. */
  localization: {
    providers: ('deepl' | 'google' | 'simulated')[];
    deepl: { apiKey: string; baseUrl: string } | undefined;
    google: { apiKey: string } | undefined;
    memberDailyCharacters: number;
    monthlyCharactersCap: number;
    cacheTtlMs: number;
  };
  /** Rights of the GDPR (§13); provisional delays, docs/open-questions.md. */
  privacy: {
    erasureGraceMs: number;
    erasureReminderMs: number;
    exportMinIntervalMs: number;
    exportTtlMs: number;
    exportUrlTtlSeconds: number;
  };
  /** Moderation (§13); provisional values, docs/open-questions.md. */
  trust: {
    moderatorMaxSuspensionDays: number;
    appealWindowMs: number;
    signals: {
      messageRequestsPerDay: number;
      connectionRequestsPerDay: number;
      reportsReceivedPerWeek: number;
    };
  };
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
  payments: PaymentsConfig;
  /** Public origin of the api, as seen by browsers, OAuth providers and email clients. */
  apiPublicUrl: string;
  /** Signs the links of the emails (unsubscribe). */
  emailLinkSecret: string;
  /** Provisional values (docs/open-questions.md). */
  messaging: { defaultPolicy: MessagePolicy; editWindowMs: number };
  notifications: { aggregationWindowMs: number; lowPriorityPerDay: number };
}

export interface PaymentsConfig {
  mode: 'simulated' | 'live';
  stripe: { secretKey: string; webhookSecret: string; apiBaseUrl: string } | undefined;
  flutterwave: { secretKey: string; webhookSecretHash: string; apiBaseUrl: string } | undefined;
  simulated: { webhookSecret: string };
  commission: { rateBps: number; version: string };
  sessionTtlMs: number;
  /** Bounds of a contribution on its EUR equivalent, in cents. */
  minEurMinor: bigint;
  maxEurMinor: bigint;
  contributionsPerHour: number;
  sessionsPerMethodPerHour: number;
  /** Above this EUR equivalent, a contribution requires two-factor authentication. */
  enhancedVerificationEurMinor: bigint;
  anonymousDonations: boolean;
}

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
}

export interface TurnstileConfig {
  siteKey: string;
  secretKey: string;
  appearance: 'interaction-only' | 'always';
}

export interface ApiConfig extends CommonConfig {
  http: {
    host: string;
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    /** Secret of the visitor address relayed by the web server; null: never trusted. */
    clientAddressSecret: string | null;
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
  messaging: CommonConfig['messaging'] & {
    /** First messages out of network a member may send in 24 hours. */
    requestsPerDay: number;
  };
  notifications: CommonConfig['notifications'] & {
    /** Svix secret of the Resend webhook; without it the webhook is refused. */
    resendWebhookSecret: string | undefined;
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
    /** Cloudflare Turnstile, absent when disabled (never in production). */
    turnstile: TurnstileConfig | undefined;
    providers: {
      google: OAuthClientConfig | undefined;
      linkedin: OAuthClientConfig | undefined;
      microsoft: OAuthClientConfig | undefined;
    };
  };
}

export interface WorkerConfig extends CommonConfig {
  worker: { healthPort: number };
  outbox: {
    pollIntervalMs: number;
    batchSize: number;
    maxBackoffMs: number;
    /** Published events and processed inbox messages are deleted after this delay. */
    retentionMs: number;
  };
  clamav: { host: string; port: number; timeoutMs: number };
  media: { orphanTtlMs: number; importTimeoutMs: number };
  /** Fixed interval replacing the cron pattern of every scheduled task (tests only). */
  scheduledTasks: { everyMs: number | undefined };
  content: { linkPreview: { timeoutMs: number; maxBytes: number } };
  /** Delay before the end of a campaign that triggers « fin de campagne proche » (provisional). */
  projects: { endingSoonMs: number };
  /** Days of provider transactions compared with the ledger by the daily reconciliation. */
  reconciliation: { lookbackMs: number };
  notifications: CommonConfig['notifications'] & {
    retentionDays: number;
    fanoutBatchSize: number;
    unreadMessageEmailDelayMs: number;
    /** Local hour of the digests in the time zone of each member. */
    digestHour: number;
    /** Delay before the start of an event at which its attendees are reminded. */
    eventReminderMs: number;
  };
  /** Purge of the CDN in front of the public bucket (ADR 0026). */
  cdn:
    | { provider: 'none' }
    | { provider: 'cloudflare'; cloudflare: { zoneId: string; apiToken: string } };
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
    access: { reauthenticationMaxAgeMs: env.ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES * 60_000 },
    localization: {
      providers: env.LOCALIZATION_PROVIDERS ?? (env.NODE_ENV === 'production' ? [] : ['simulated']),
      deepl: env.DEEPL_API_KEY
        ? { apiKey: env.DEEPL_API_KEY, baseUrl: withoutTrailingSlash(env.DEEPL_API_BASE_URL) }
        : undefined,
      google: env.GOOGLE_TRANSLATE_API_KEY ? { apiKey: env.GOOGLE_TRANSLATE_API_KEY } : undefined,
      memberDailyCharacters: env.LOCALIZATION_MEMBER_DAILY_CHARACTERS,
      monthlyCharactersCap: env.LOCALIZATION_MONTHLY_CHARACTERS_CAP,
      cacheTtlMs: env.LOCALIZATION_CACHE_TTL_DAYS * 86_400_000,
    },
    privacy: {
      erasureGraceMs: env.PRIVACY_ERASURE_GRACE_DAYS * 86_400_000,
      erasureReminderMs: env.PRIVACY_ERASURE_REMINDER_DAYS * 86_400_000,
      exportMinIntervalMs: env.PRIVACY_EXPORT_MIN_INTERVAL_HOURS * 3_600_000,
      exportTtlMs: env.PRIVACY_EXPORT_TTL_HOURS * 3_600_000,
      exportUrlTtlSeconds: env.PRIVACY_EXPORT_URL_TTL_SECONDS,
    },
    trust: {
      moderatorMaxSuspensionDays: env.TRUST_MODERATOR_MAX_SUSPENSION_DAYS,
      appealWindowMs: env.TRUST_APPEAL_WINDOW_DAYS * 86_400_000,
      signals: {
        messageRequestsPerDay: env.TRUST_SIGNAL_MESSAGE_REQUESTS_PER_DAY,
        connectionRequestsPerDay: env.TRUST_SIGNAL_CONNECTION_REQUESTS_PER_DAY,
        reportsReceivedPerWeek: env.TRUST_SIGNAL_REPORTS_RECEIVED_PER_WEEK,
      },
    },
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
    payments: {
      mode: env.PAYMENTS_MODE,
      stripe:
        env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
          ? {
              secretKey: env.STRIPE_SECRET_KEY,
              webhookSecret: env.STRIPE_WEBHOOK_SECRET,
              apiBaseUrl: withoutTrailingSlash(env.STRIPE_API_BASE_URL),
            }
          : undefined,
      flutterwave:
        env.FLUTTERWAVE_SECRET_KEY && env.FLUTTERWAVE_WEBHOOK_SECRET_HASH
          ? {
              secretKey: env.FLUTTERWAVE_SECRET_KEY,
              webhookSecretHash: env.FLUTTERWAVE_WEBHOOK_SECRET_HASH,
              apiBaseUrl: withoutTrailingSlash(env.FLUTTERWAVE_API_BASE_URL),
            }
          : undefined,
      simulated: { webhookSecret: env.PAYMENTS_SIMULATED_WEBHOOK_SECRET },
      commission: {
        rateBps: env.PAYMENTS_COMMISSION_RATE_BPS,
        version: env.PAYMENTS_COMMISSION_VERSION,
      },
      sessionTtlMs: env.PAYMENTS_SESSION_TTL_MINUTES * 60_000,
      minEurMinor: BigInt(env.PAYMENTS_MIN_EUR_MINOR),
      maxEurMinor: BigInt(env.PAYMENTS_MAX_EUR_MINOR),
      contributionsPerHour: env.PAYMENTS_CONTRIBUTIONS_PER_HOUR,
      sessionsPerMethodPerHour: env.PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR,
      enhancedVerificationEurMinor: BigInt(env.PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR),
      anonymousDonations: env.PAYMENTS_ANONYMOUS_DONATIONS,
    },
    apiPublicUrl: withoutTrailingSlash(env.API_PUBLIC_URL),
    emailLinkSecret: env.EMAIL_LINK_SECRET,
    messaging: {
      defaultPolicy: env.MESSAGING_DEFAULT_POLICY,
      editWindowMs: env.MESSAGING_EDIT_WINDOW_MINUTES * 60_000,
    },
    notifications: {
      aggregationWindowMs: env.NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES * 60_000,
      lowPriorityPerDay: env.NOTIFICATIONS_LOW_PRIORITY_PER_DAY,
    },
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

function turnstile(env: ApiEnv): TurnstileConfig | undefined {
  return env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY
    ? {
        siteKey: env.TURNSTILE_SITE_KEY,
        secretKey: env.TURNSTILE_SECRET_KEY,
        appearance: env.TURNSTILE_APPEARANCE,
      }
    : undefined;
}

export function parseApiConfig(rawEnv: RawEnv): ApiConfig {
  const env: ApiEnv = parse(apiEnv, rawEnv);
  const common = toCommonConfig(env);
  return {
    ...common,
    messaging: { ...common.messaging, requestsPerDay: env.MESSAGING_REQUESTS_PER_DAY },
    notifications: { ...common.notifications, resendWebhookSecret: env.RESEND_WEBHOOK_SECRET },
    http: {
      host: env.API_HOST,
      port: env.API_PORT,
      corsOrigins: env.CORS_ORIGINS,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      clientAddressSecret: env.WEB_CLIENT_ADDRESS_SECRET ?? null,
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
      turnstile: turnstile(env),
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
  const common = toCommonConfig(env);
  return {
    ...common,
    notifications: {
      ...common.notifications,
      retentionDays: env.NOTIFICATIONS_RETENTION_DAYS,
      fanoutBatchSize: env.NOTIFICATIONS_FANOUT_BATCH_SIZE,
      unreadMessageEmailDelayMs: env.NOTIFICATIONS_UNREAD_MESSAGE_EMAIL_DELAY_MINUTES * 60_000,
      digestHour: env.NOTIFICATIONS_DIGEST_HOUR,
      eventReminderMs: env.NOTIFICATIONS_EVENT_REMINDER_HOURS * 3_600_000,
    },
    worker: { healthPort: env.WORKER_HEALTH_PORT },
    outbox: {
      pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
      batchSize: env.OUTBOX_BATCH_SIZE,
      maxBackoffMs: env.OUTBOX_MAX_BACKOFF_MS,
      retentionMs: env.OUTBOX_RETENTION_DAYS * 86_400_000,
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
    projects: { endingSoonMs: env.PROJECTS_ENDING_SOON_HOURS * 3_600_000 },
    reconciliation: { lookbackMs: env.PAYMENTS_RECONCILIATION_LOOKBACK_DAYS * 86_400_000 },
    cdn:
      env.CDN_PURGE_PROVIDER === 'cloudflare'
        ? {
            provider: 'cloudflare',
            cloudflare: {
              zoneId: env.CLOUDFLARE_ZONE_ID ?? '',
              apiToken: env.CLOUDFLARE_API_TOKEN ?? '',
            },
          }
        : { provider: 'none' },
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
