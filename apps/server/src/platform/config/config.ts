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
}

export interface ApiConfig extends CommonConfig {
  http: {
    host: string;
    port: number;
    corsOrigins: string[];
    trustProxyHops: number;
    swaggerEnabled: boolean;
  };
  rateLimit: { ttlMs: number; limit: number };
  idempotency: { ttlMs: number };
}

export interface WorkerConfig extends CommonConfig {
  worker: { healthPort: number };
  outbox: { pollIntervalMs: number; batchSize: number; maxBackoffMs: number };
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
      publicBaseUrl: env.S3_PUBLIC_BASE_URL.replace(/\/+$/, ''),
    },
    mail:
      env.MAIL_TRANSPORT === 'smtp'
        ? { transport: 'smtp', from: env.MAIL_FROM, smtpUrl: env.SMTP_URL ?? '' }
        : { transport: 'resend', from: env.MAIL_FROM, resendApiKey: env.RESEND_API_KEY ?? '' },
    sentry: { dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV },
    otel: { enabled: env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined },
  };
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
    },
    rateLimit: { ttlMs: env.RATE_LIMIT_TTL_SECONDS * 1000, limit: env.RATE_LIMIT_MAX },
    idempotency: { ttlMs: env.IDEMPOTENCY_TTL_HOURS * 3_600_000 },
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
