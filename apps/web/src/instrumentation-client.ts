import type * as Sdk from '@sentry/nextjs';
import { sentryOptions } from '@/lib/observability/sentry';
import { publicEnv } from '@/lib/public-env';

type SentrySdk = typeof Sdk;

let sentry: SentrySdk | undefined;

/**
 * Sentry in the browser, only when a DSN is configured (ADR 0091), loaded after the page so that
 * it never weighs on the first load.
 */
if (publicEnv.sentryDsn) {
  const dsn = publicEnv.sentryDsn;
  void import('@sentry/nextjs').then((sdk) => {
    sentry = sdk;
    sdk.init(sentryOptions(dsn, publicEnv.sentryEnvironment));
  });
}

export function onRouterTransitionStart(
  ...args: Parameters<SentrySdk['captureRouterTransitionStart']>
): void {
  sentry?.captureRouterTransitionStart(...args);
}
