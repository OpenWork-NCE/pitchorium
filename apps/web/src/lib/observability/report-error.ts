import { publicEnv } from '@/lib/public-env';

/**
 * Reports an unexpected error to Sentry when a DSN is configured; the SDK is loaded on demand,
 * never part of the first load of a page.
 */
export function reportError(error: unknown): void {
  if (!publicEnv.sentryDsn) return;
  void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
}
