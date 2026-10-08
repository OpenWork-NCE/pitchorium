import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/observability/sentry';

/** Sentry on the Next.js server, only when a DSN is configured (ADR 0091). */
export function register(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init(sentryOptions(dsn, process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development'));
}

export const onRequestError = Sentry.captureRequestError;
