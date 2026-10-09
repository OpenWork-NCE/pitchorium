import { routes } from '@/config/routes';
import { withRedirect } from '@/lib/auth/redirect';

/**
 * Addresses of the web app handed to /v1/auth: absolute, since Better Auth redirects the browser
 * to them from the api (an origin trusted by the api, ADR 0021).
 */
export function absoluteUrl(locale: string, path: string): string {
  return `${window.location.origin}/${locale}${path}`;
}

/** Where a sign-in lands: the resolver applies the terms first, then the page asked for. */
export function continuePath(redirectTo: string | null): string {
  return withRedirect(routes.continue, redirectTo);
}

/**
 * After a sign-in: a full navigation to the resolver, so that every server component reads the
 * new session (the cookie of the api).
 */
export function landAfterSignIn(locale: string, redirectTo: string | null): void {
  window.location.assign(new URL(`/${locale}${continuePath(redirectTo)}`, window.location.origin));
}
