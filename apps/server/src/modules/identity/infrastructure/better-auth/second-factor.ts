import { randomBytes } from 'node:crypto';
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { deleteSessionCookie } from 'better-auth/cookies';

/** Cookie and verification records read by the two-factor plugin of Better Auth. */
const TWO_FACTOR_COOKIE = 'two_factor';
const CHALLENGE_TTL_SECONDS = 600;

/**
 * Endpoints that turn the second factor on or off, or show its secrets: without a password to
 * confirm them (an account opened by Google, LinkedIn or Microsoft), the session must be recent.
 */
export const PASSWORDLESS_SECOND_FACTOR_PATHS: ReadonlySet<string> = new Set([
  '/two-factor/enable',
  '/two-factor/disable',
  '/two-factor/generate-backup-codes',
  '/two-factor/get-totp-uri',
]);

/**
 * Sign-ins that the two-factor plugin does not challenge (it only knows `/sign-in/email`): a
 * provider callback, a sign-in link, the sign-in that follows an email verification, and a
 * direct sign-in with a provider token.
 */
export const CHALLENGED_SIGN_IN_PATHS: ReadonlySet<string> = new Set([
  '/callback/:id',
  '/magic-link/verify',
  '/verify-email',
  '/sign-in/social',
]);

export interface SecondFactorOptions {
  /** Origin of the web app, whose page asks for the code (`/sign-in/two-factor`). */
  webAppUrl: string;
  /** A session older than this cannot manage the second factor of a passwordless account. */
  reauthenticationMaxAgeMs: number;
}

interface HookContext {
  path?: string;
  context: {
    returned?: unknown;
    responseHeaders?: Headers;
  };
}

/** Path and query of a web address of the redirect, the locale prefix kept apart. */
function webTarget(
  location: string | null,
  webAppUrl: string,
): { locale: string | null; path: string } {
  if (!location) return { locale: null, path: '' };
  const url = new URL(location, webAppUrl);
  if (url.origin !== new URL(webAppUrl).origin) return { locale: null, path: '' };
  const [, first] = url.pathname.split('/');
  const locale = first && /^[a-z]{2}$/.test(first) ? first : null;
  // A sign-in lands on `/continue?redirectTo=...`: the page of the code goes there itself.
  if (locale && url.pathname === `/${locale}/continue`) {
    return { locale, path: url.searchParams.get('redirectTo') ?? '' };
  }
  return { locale, path: `${url.pathname}${url.search}` };
}

/** The page of the web app that asks for the code, then lands where the sign-in was going. */
export function challengeUrl(location: string | null, webAppUrl: string): string {
  const { locale, path } = webTarget(location, webAppUrl);
  const page = new URL(`${locale ? `/${locale}` : ''}/sign-in/two-factor`, webAppUrl);
  if (path) page.searchParams.set('redirectTo', path);
  return page.toString();
}

/** Target of a redirect answered by the endpoint (its headers, or those of the thrown redirect). */
function locationOf(returned: unknown, headers: Headers | undefined): string | null {
  const fromHeaders = headers?.get('location');
  if (fromHeaders) return fromHeaders;
  const thrown = returned as
    { headers?: ConstructorParameters<typeof Headers>[0] } | null | undefined;
  return thrown?.headers ? new Headers(thrown.headers).get('location') : null;
}

/**
 * Second factor on every way in (ADR 0108). Better Auth asks for the code after a password only;
 * a member who turned it on and signs in with a provider or a link is challenged here the same
 * way: the new session is dropped, a challenge cookie is set, and the browser goes to the page of
 * the code. An account without a password manages its second factor on a recent session only.
 */
export function secondFactorEverywhere(options: SecondFactorOptions): BetterAuthPlugin {
  return {
    id: 'pitchorium-second-factor',
    hooks: {
      before: [
        {
          matcher: (context: HookContext) =>
            PASSWORDLESS_SECOND_FACTOR_PATHS.has(context.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const session = await getSessionFromCtx(ctx);
            if (!session) return;
            const credential = await ctx.context.internalAdapter.findCredentialAccount(
              session.user.id,
            );
            // With a password, Better Auth asks for it: nothing to add.
            if (credential?.password) return;
            const openedAt = new Date(session.session.createdAt).getTime();
            if (Date.now() - openedAt > options.reauthenticationMaxAgeMs) {
              throw new APIError('FORBIDDEN', {
                code: 'SESSION_NOT_FRESH',
                message: 'Sign in again to manage the second factor.',
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (context: HookContext) => CHALLENGED_SIGN_IN_PATHS.has(context.path ?? ''),
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession;
            if (!created?.user.twoFactorEnabled) return;
            const returned = (ctx.context as HookContext['context']).returned;
            const headers = (ctx.context as HookContext['context']).responseHeaders;
            deleteSessionCookie(ctx, true);
            await ctx.context.internalAdapter.deleteSession(created.session.token);
            ctx.context.setNewSession(null);
            const identifier = `2fa-${randomBytes(15).toString('base64url')}`;
            const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000);
            await ctx.context.internalAdapter.createVerificationValue({
              value: created.user.id,
              identifier,
              expiresAt,
            });
            await ctx.context.internalAdapter.createVerificationValue({
              value: '0',
              identifier: `2fa-attempts-${identifier}`,
              expiresAt,
            });
            const cookie = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE, {
              maxAge: CHALLENGE_TTL_SECONDS,
            });
            await ctx.setSignedCookie(
              cookie.name,
              identifier,
              ctx.context.secret,
              cookie.attributes,
            );
            const location = locationOf(returned, headers);
            // A redirect (provider, link, verification) goes to the page of the code; a direct
            // sign-in answers like the password one, and the client opens that page.
            if (location) throw ctx.redirect(challengeUrl(location, options.webAppUrl));
            return ctx.json({ twoFactorRedirect: true, twoFactorMethods: ['totp'] });
          }),
        },
      ],
    },
  };
}
