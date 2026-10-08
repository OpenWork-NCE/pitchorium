import { MESSAGE_POLICIES } from '@pitchorium/contracts';
import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const urlList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()));

/** Default of EMAIL_LINK_SECRET outside production only. */
export const DEVELOPMENT_EMAIL_LINK_SECRET = 'email-link-secret-for-development-only';

const commonEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  QUEUE_PREFIX: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .default('pitchorium'),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('auto'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString.default(false),
  S3_BUCKET_PUBLIC: z.string().min(3),
  S3_BUCKET_PRIVATE: z.string().min(3),
  S3_PUBLIC_BASE_URL: z.url(),
  MAIL_TRANSPORT: z.enum(['smtp', 'resend']),
  MAIL_FROM: z.string().min(3),
  SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.url().optional(),
  SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  WEB_APP_URL: z.url().default('http://localhost:5173'),
  LEGAL_TERMS_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  LEGAL_PRIVACY_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  NETWORK_PROFILE_VIEWS_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  // Public origin of the api: links of the emails (one-click unsubscribe) and OAuth callbacks.
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
  // Signs the links of the emails (unsubscribe); a development value is refused in production.
  EMAIL_LINK_SECRET: z.string().min(32).default(DEVELOPMENT_EMAIL_LINK_SECRET),
  // Messaging and notifications (docs/architecture/notifications.md), provisional values.
  MESSAGING_DEFAULT_POLICY: z.enum(MESSAGE_POLICIES).default('connections_and_second_degree'),
  MESSAGING_EDIT_WINDOW_MINUTES: z.coerce.number().int().min(0).max(10_080).default(15),
  NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_080)
    .default(1440),
  NOTIFICATIONS_LOW_PRIORITY_PER_DAY: z.coerce.number().int().min(1).max(1000).default(20),
  ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  TRUST_MODERATOR_MAX_SUSPENSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  TRUST_APPEAL_WINDOW_DAYS: z.coerce.number().int().min(1).max(3650).default(183),
  TRUST_SIGNAL_MESSAGE_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(10_000).default(15),
  TRUST_SIGNAL_CONNECTION_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(10_000).default(50),
  TRUST_SIGNAL_REPORTS_RECEIVED_PER_WEEK: z.coerce.number().int().min(1).max(10_000).default(3),
  /** Unset: simulated outside production, none in production (translation unavailable). */
  LOCALIZATION_PROVIDERS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(['deepl', 'google', 'simulated'])))
    .optional(),
  DEEPL_API_KEY: z.string().min(1).optional(),
  DEEPL_API_BASE_URL: z.url().default('https://api-free.deepl.com'),
  GOOGLE_TRANSLATE_API_KEY: z.string().min(1).optional(),
  LOCALIZATION_MEMBER_DAILY_CHARACTERS: z.coerce.number().int().min(0).default(20_000),
  LOCALIZATION_MONTHLY_CHARACTERS_CAP: z.coerce.number().int().min(0).default(500_000),
  LOCALIZATION_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  PRIVACY_ERASURE_GRACE_DAYS: z.coerce.number().int().min(0).max(365).default(30),
  PRIVACY_ERASURE_REMINDER_DAYS: z.coerce.number().int().min(0).max(365).default(7),
  PRIVACY_EXPORT_MIN_INTERVAL_HOURS: z.coerce.number().int().min(0).max(8760).default(24),
  PRIVACY_EXPORT_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  PRIVACY_EXPORT_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).default(300),
  // Payments (section 9): providers, commission and limits (docs/architecture/payments.md).
  PAYMENTS_MODE: z.enum(['simulated', 'live']).default('simulated'),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_API_BASE_URL: z.url().default('https://api.stripe.com'),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1).optional(),
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().min(1).optional(),
  FLUTTERWAVE_API_BASE_URL: z.url().default('https://api.flutterwave.com'),
  PAYMENTS_SIMULATED_WEBHOOK_SECRET: z
    .string()
    .min(16)
    .default('simulated-webhook-secret-for-development-only'),
  PAYMENTS_COMMISSION_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(500),
  PAYMENTS_COMMISSION_VERSION: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,32}$/)
    .default('2026-10'),
  PAYMENTS_SESSION_TTL_MINUTES: z.coerce.number().int().min(30).max(1440).default(60),
  PAYMENTS_MIN_EUR_MINOR: z.coerce.number().int().min(1).default(100),
  PAYMENTS_MAX_EUR_MINOR: z.coerce.number().int().min(1).default(1_000_000),
  PAYMENTS_CONTRIBUTIONS_PER_HOUR: z.coerce.number().int().min(1).default(10),
  PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR: z.coerce.number().int().min(1).default(5),
  PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR: z.coerce.number().int().min(1).default(100_000),
  PAYMENTS_ANONYMOUS_DONATIONS: booleanFromString.default(false),
});

const apiEnvSchema = commonEnvSchema.extend({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: urlList,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().positive().default(24),
  AUTH_SECRET: z.string().min(32),
  AUTH_TRUSTED_ORIGINS: urlList,
  AUTH_COOKIE_DOMAIN: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .optional(),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_PWNED_PASSWORD_CHECK: booleanFromString.default(true),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  LINKEDIN_CLIENT_ID: z.string().min(1).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  MEDIA_UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  MEDIA_DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(300),
  MEDIA_QUOTA_MAX_FILES: z.coerce.number().int().positive().default(500),
  MEDIA_QUOTA_MAX_BYTES: z.coerce.number().int().positive().default(1_073_741_824),
  MEDIA_UPLOAD_REQUESTS_PER_HOUR: z.coerce.number().int().positive().default(60),
  ORGANIZATIONS_MAX_CREATED_PER_USER: z.coerce.number().int().positive().default(5),
  ORGANIZATIONS_INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  NETWORK_CONNECTION_REQUESTS_PER_WEEK: z.coerce.number().int().positive().default(100),
  NETWORK_DECLINE_COOLDOWN_DAYS: z.coerce.number().int().min(0).max(365).default(21),
  NETWORK_REQUEST_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  NETWORK_MUTUAL_CONNECTIONS_CAP: z.coerce.number().int().min(1).max(100_000).default(999),
  MESSAGING_REQUESTS_PER_DAY: z.coerce.number().int().min(1).max(1000).default(20),
  // Svix signing secret of the Resend webhook (`whsec_...`); the route refuses everything without.
  RESEND_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
  CONTENT_FEED_EDITORIAL_THRESHOLD: z.coerce.number().int().min(0).max(1000).default(10),
  ORGANIZATIONS_VERIFICATION_CRITERIA: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[a-z0-9_]{1,48}$/))),
});

const workerEnvSchema = commonEnvSchema.extend({
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().max(1000).default(100),
  OUTBOX_MAX_BACKOFF_MS: z.coerce.number().int().positive().default(300_000),
  OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(2).max(3650).default(30),
  CLAMAV_HOST: z.string().min(1).default('localhost'),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  MEDIA_ORPHAN_TTL_HOURS: z.coerce.number().int().positive().default(24),
  MEDIA_IMPORT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  SCHEDULED_TASKS_EVERY_MS: z.coerce.number().int().min(100).optional(),
  CONTENT_LINK_PREVIEW_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CONTENT_LINK_PREVIEW_MAX_BYTES: z.coerce.number().int().positive().default(1_048_576),
  PROJECTS_ENDING_SOON_HOURS: z.coerce.number().int().min(1).max(2160).default(72),
  NOTIFICATIONS_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  NOTIFICATIONS_FANOUT_BATCH_SIZE: z.coerce.number().int().min(10).max(10_000).default(500),
  NOTIFICATIONS_UNREAD_MESSAGE_EMAIL_DELAY_MINUTES: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_080)
    .default(30),
  NOTIFICATIONS_DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  NOTIFICATIONS_EVENT_REMINDER_HOURS: z.coerce.number().int().min(1).max(336).default(24),
  PAYMENTS_RECONCILIATION_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(90).default(3),
  CDN_PURGE_PROVIDER: z.enum(['none', 'cloudflare']).default('none'),
  CLOUDFLARE_ZONE_ID: z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .optional(),
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
});

function requireMailCredentials(env: z.infer<typeof commonEnvSchema>, ctx: z.RefinementCtx): void {
  if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_URL) {
    ctx.addIssue({
      code: 'custom',
      path: ['SMTP_URL'],
      message: 'Required when MAIL_TRANSPORT=smtp',
    });
  }
  if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['RESEND_API_KEY'],
      message: 'Required when MAIL_TRANSPORT=resend',
    });
  }
}

/**
 * A provider is enabled with its secret key and its webhook secret; the simulated provider is
 * refused in production (ADR 0052), where at least one live provider is required.
 */
function requirePaymentProviders(env: z.infer<typeof commonEnvSchema>, ctx: z.RefinementCtx): void {
  const pairs = [
    ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    ['FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_WEBHOOK_SECRET_HASH'],
  ] as const;
  for (const [key, secret] of pairs) {
    if ((env[key] === undefined) !== (env[secret] === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [env[key] === undefined ? key : secret],
        message: `Set both ${key} and ${secret}, or neither`,
      });
    }
  }
  if (env.NODE_ENV === 'production' && env.PAYMENTS_MODE === 'simulated') {
    ctx.addIssue({
      code: 'custom',
      path: ['PAYMENTS_MODE'],
      message: 'The simulated payment provider is refused in production',
    });
  }
  if (
    env.PAYMENTS_MODE === 'live' &&
    env.STRIPE_SECRET_KEY === undefined &&
    env.FLUTTERWAVE_SECRET_KEY === undefined
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['PAYMENTS_MODE'],
      message: 'PAYMENTS_MODE=live requires the Stripe or Flutterwave credentials',
    });
  }
  if (env.PAYMENTS_MIN_EUR_MINOR > env.PAYMENTS_MAX_EUR_MINOR) {
    ctx.addIssue({
      code: 'custom',
      path: ['PAYMENTS_MIN_EUR_MINOR'],
      message: 'Must not exceed PAYMENTS_MAX_EUR_MINOR',
    });
  }
}

/** A listed provider needs its key; the simulated one is refused in production. */
function requireTranslationProviders(
  env: z.infer<typeof commonEnvSchema>,
  ctx: z.RefinementCtx,
): void {
  const missing = [
    ['deepl', env.DEEPL_API_KEY, 'DEEPL_API_KEY'],
    ['google', env.GOOGLE_TRANSLATE_API_KEY, 'GOOGLE_TRANSLATE_API_KEY'],
  ] as const;
  for (const [provider, key, name] of missing) {
    if (env.LOCALIZATION_PROVIDERS?.includes(provider) && key === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: [name],
        message: `Required by LOCALIZATION_PROVIDERS=${provider}`,
      });
    }
  }
  if (env.NODE_ENV === 'production' && env.LOCALIZATION_PROVIDERS?.includes('simulated')) {
    ctx.addIssue({
      code: 'custom',
      path: ['LOCALIZATION_PROVIDERS'],
      message: 'The simulated translation provider is refused in production',
    });
  }
}

/** The signing secret of the email links must be a real secret in production. */
function refuseDevelopmentEmailSecret(
  env: z.infer<typeof commonEnvSchema>,
  ctx: z.RefinementCtx,
): void {
  if (env.NODE_ENV === 'production' && env.EMAIL_LINK_SECRET === DEVELOPMENT_EMAIL_LINK_SECRET) {
    ctx.addIssue({
      code: 'custom',
      path: ['EMAIL_LINK_SECRET'],
      message: 'Set a secret of at least 32 characters in production',
    });
  }
}

const OAUTH_PROVIDERS = ['GOOGLE', 'LINKEDIN', 'MICROSOFT'] as const;

/** An OAuth provider is enabled only when both its client id and secret are set. */
function requireCompleteOAuthCredentials(
  env: z.infer<typeof apiEnvSchema>,
  ctx: z.RefinementCtx,
): void {
  for (const provider of OAUTH_PROVIDERS) {
    const id = env[`${provider}_CLIENT_ID`];
    const secret = env[`${provider}_CLIENT_SECRET`];
    if ((id === undefined) !== (secret === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [id === undefined ? `${provider}_CLIENT_ID` : `${provider}_CLIENT_SECRET`],
        message: `Set both ${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET, or neither`,
      });
    }
  }
}

export const apiEnv = apiEnvSchema
  .superRefine(requireMailCredentials)
  .superRefine(refuseDevelopmentEmailSecret)
  .superRefine(requirePaymentProviders)
  .superRefine(requireTranslationProviders)
  .superRefine(requireCompleteOAuthCredentials);
/** The interval override replaces every cron pattern: tests and local debugging only. */
function refuseScheduleOverrideInProduction(
  env: z.infer<typeof workerEnvSchema>,
  ctx: z.RefinementCtx,
): void {
  if (env.NODE_ENV === 'production' && env.SCHEDULED_TASKS_EVERY_MS !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['SCHEDULED_TASKS_EVERY_MS'],
      message: 'Not allowed in production',
    });
  }
}

/**
 * Public files are cached for a year by the CDN (ADR 0026): in production, a file that becomes
 * private must be purged, so a purge provider is required.
 */
function requireCdnPurge(env: z.infer<typeof workerEnvSchema>, ctx: z.RefinementCtx): void {
  if (env.CDN_PURGE_PROVIDER === 'cloudflare') {
    for (const name of ['CLOUDFLARE_ZONE_ID', 'CLOUDFLARE_API_TOKEN'] as const) {
      if (env[name] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'Required when CDN_PURGE_PROVIDER=cloudflare',
        });
      }
    }
  } else if (env.NODE_ENV === 'production') {
    ctx.addIssue({
      code: 'custom',
      path: ['CDN_PURGE_PROVIDER'],
      message: 'A CDN purge provider is required in production',
    });
  }
}

export const workerEnv = workerEnvSchema
  .superRefine(requireMailCredentials)
  .superRefine(refuseDevelopmentEmailSecret)
  .superRefine(requirePaymentProviders)
  .superRefine(requireTranslationProviders)
  .superRefine(refuseScheduleOverrideInProduction)
  .superRefine(requireCdnPurge);

export type CommonEnv = z.infer<typeof commonEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
