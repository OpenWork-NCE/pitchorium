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
});

const apiEnvSchema = commonEnvSchema.extend({
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_PUBLIC_URL: z.url().default('http://localhost:3000'),
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
  CLAMAV_HOST: z.string().min(1).default('localhost'),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  MEDIA_ORPHAN_TTL_HOURS: z.coerce.number().int().positive().default(24),
  MEDIA_IMPORT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
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
  .superRefine(requireCompleteOAuthCredentials);
export const workerEnv = workerEnvSchema.superRefine(requireMailCredentials);

export type CommonEnv = z.infer<typeof commonEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
