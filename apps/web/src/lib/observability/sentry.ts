import type * as Sentry from '@sentry/nextjs';

type InitOptions = NonNullable<Parameters<typeof Sentry.init>[0]>;

/**
 * Options shared by the server and the browser (ADR 0091). Nothing that identifies a member
 * leaves for Sentry: no user field, no cookie (the session), no header, no body, no query string.
 */
export function sentryOptions(dsn: string, environment: string): InitOptions {
  return {
    dsn,
    environment,
    tracesSampleRate: 0.1,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  };
}
