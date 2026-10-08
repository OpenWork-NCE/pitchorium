import { Logger } from '@nestjs/common';
import { DEFAULT_LOCALE, MIN_PASSWORD_LENGTH } from '@pitchorium/contracts';
import {
  identityAccounts,
  identitySessions,
  identityTwoFactors,
  identityUsers,
  identityVerifications,
} from '@pitchorium/db/schemas/identity';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { captcha, magicLink, twoFactor } from 'better-auth/plugins';
import type { Redis } from 'ioredis';
import type { ApiConfig } from '../../../../platform/config';
import type { TransactionManager } from '../../../../platform/database';
import type { IdGenerator } from '../../../../platform/kernel';
import type { Metrics } from '../../../../platform/observability';
import type { ActiveLocalesService } from '../../application/active-locales.service';
import type { IdentityEventsRecorder } from '../../application/identity-events.recorder';
import type { IdentityUserRepository } from '../../application/identity-user.repository';
import { negotiateLocale } from '../../domain/locale-negotiation';
import { timeZoneOrDefault } from '../../domain/time-zone';
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  type IdentityMailer,
  MAGIC_LINK_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
} from '../identity-mailer';
import type { AuthRequestScope } from './auth-request-scope';
import { withIdentityEvents } from './identity-events.adapter';
import { checkPwnedPassword } from './pwned-passwords';
import { RedisRateLimitStorage } from './redis-rate-limit.storage';
import { transactionalDatabase } from './transactional-database';

export const AUTH_BASE_PATH = '/v1/auth';
export const AUTH_COOKIE_PREFIX = 'pitchorium';
/** Set by the HTTP handler from the Express client IP (honours TRUST_PROXY_HOPS). */
export const CLIENT_IP_HEADER = 'x-pitchorium-client-ip';

const SESSION_TTL_SECONDS = 30 * 24 * 3600;
const SESSION_REFRESH_AFTER_SECONDS = 24 * 3600;
const MAX_USER_AGENT_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;

/** Endpoints that can be used to guess passwords, spam inboxes or enumerate accounts. */
const SENSITIVE_PATHS = [
  '/sign-in/email',
  '/sign-in/social',
  '/change-password',
  '/change-email',
  '/sign-up/email',
  '/sign-in/magic-link',
  '/magic-link/verify',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/two-factor/verify-totp',
  '/two-factor/verify-backup-code',
];

/**
 * Endpoints checked by Cloudflare Turnstile when it is configured (ADR 0103): every way to create
 * an account, to try a password or to send an email to an address typed by anyone.
 */
export const CAPTCHA_PATHS = [
  '/sign-up/email',
  '/sign-in/email',
  '/sign-in/magic-link',
  '/request-password-reset',
];

/** Body field holding the new password, for the endpoints that set one. */
const NEW_PASSWORD_FIELDS: Readonly<Record<string, string>> = {
  '/sign-up/email': 'password',
  '/change-password': 'newPassword',
  '/reset-password': 'newPassword',
};

/** Sessions opened by these endpoints replace one of the same device: no "new sign-in" email. */
const SAME_DEVICE_SESSION_PATHS: ReadonlySet<string> = new Set([
  '/verify-email',
  '/change-password',
]);

export interface BetterAuthDependencies {
  config: ApiConfig;
  transactions: TransactionManager;
  redis: Redis;
  ids: IdGenerator;
  scope: AuthRequestScope;
  users: IdentityUserRepository;
  events: IdentityEventsRecorder;
  mailer: IdentityMailer;
  locales: ActiveLocalesService;
  metrics: Metrics;
}

/** Counter of password checks skipped because Have I Been Pwned gave no usable answer. */
export const PWNED_CHECK_UNAVAILABLE_METRIC = 'pitchorium.identity.pwned_check.unavailable';

interface HookContext {
  path?: string;
  headers?: Headers;
  request?: Request;
}

function headerOf(context: HookContext | null | undefined, name: string): string | null {
  return context?.headers?.get(name) ?? context?.request?.headers.get(name) ?? null;
}

/**
 * Better Auth configuration. Linking policy (ADR 0014): Google and LinkedIn link implicitly only
 * when the provider asserts a verified email and the local email is verified too; Microsoft never
 * links implicitly, because Entra ID lets tenants assert arbitrary emails.
 */
export function createBetterAuth(deps: BetterAuthDependencies) {
  const { config, scope, users, events, mailer, metrics } = deps;
  const logger = new Logger('BetterAuth');
  const { providers } = config.auth;

  const recipient = async (user: { id: string; email: string; name: string }) => {
    const stored = await users.findById(user.id);
    return { email: user.email, name: user.name, locale: stored?.locale ?? DEFAULT_LOCALE };
  };

  /**
   * Have I Been Pwned is called before the endpoint, never inside a database transaction
   * (ADR 0019). A password outside the length limits is left to Better Auth's validation. The
   * check fails open: when the service is unreachable, too slow or answers an error, the
   * password is accepted, with a warning and a metric.
   */
  async function rejectCompromisedPassword(password: unknown, path: string): Promise<void> {
    if (
      !config.auth.pwnedPasswordCheck ||
      typeof password !== 'string' ||
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return;
    }
    const result = await checkPwnedPassword(password);
    if (result.status === 'unavailable') {
      logger.warn(
        `Have I Been Pwned unavailable (${result.reason}: ${result.detail}), password accepted on ${path}`,
      );
      metrics.increment(PWNED_CHECK_UNAVAILABLE_METRIC, { reason: result.reason, path });
      return;
    }
    if (result.status === 'compromised') {
      throw new APIError('BAD_REQUEST', {
        code: 'PASSWORD_COMPROMISED',
        message: 'The password you entered has been compromised. Please choose another one.',
      });
    }
  }

  return betterAuth({
    appName: 'Pitchorium',
    baseURL: config.http.publicUrl,
    basePath: AUTH_BASE_PATH,
    secret: config.auth.secret,
    trustedOrigins: [...new Set([...config.auth.trustedOrigins, config.webAppUrl])],
    telemetry: { enabled: false },
    logger: {
      level: config.env === 'production' ? 'warn' : 'info',
      log: (level, message, ...args) => {
        const line = [message, ...args.map((arg) => String(arg))].join(' ');
        if (level === 'error') logger.error(line);
        else if (level === 'warn') logger.warn(line);
        else logger.debug(line);
      },
    },
    // Better Auth transactions become TransactionManager transactions, and each write commits
    // with its identity event (ADR 0019).
    database: withIdentityEvents(
      drizzleAdapter(transactionalDatabase(deps.transactions), {
        provider: 'pg',
        transaction: true,
        schema: {
          user: identityUsers,
          session: identitySessions,
          account: identityAccounts,
          verification: identityVerifications,
          twoFactor: identityTwoFactors,
        },
      }),
      { transactions: deps.transactions, scope, events },
    ),
    user: {
      additionalFields: {
        // Not returned: the generic answer to a duplicate sign-up has no negotiated locale, so
        // returning it would reveal that the account exists. Read it from GET /v1/me.
        locale: { type: 'string', required: false, input: false, returned: false },
        timeZone: { type: 'string', required: false, input: false, returned: false },
      },
    },
    session: {
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: SESSION_REFRESH_AFTER_SECONDS,
    },
    account: {
      accountLinking: {
        enabled: true,
        // No provider is trusted by name: implicit linking relies on the provider's
        // email_verified claim, which Microsoft never sets (see mapProfileToUser below).
        trustedProviders: [],
        requireLocalEmailVerified: true,
        // Explicit linking from a signed-in account may use another email address.
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        updateUserInfoOnLink: false,
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      // Without auto sign-in, signing up with a known email answers like a new sign-up.
      autoSignIn: false,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const to = await recipient(user);
        await scope.defer(() => mailer.sendPasswordReset(to, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: EMAIL_VERIFICATION_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        const to = await recipient(user);
        await scope.defer(() => mailer.sendEmailVerification(to, url));
      },
    },
    socialProviders: {
      ...(providers.google ? { google: { ...providers.google, prompt: 'select_account' } } : {}),
      ...(providers.linkedin ? { linkedin: { ...providers.linkedin } } : {}),
      ...(providers.microsoft
        ? {
            microsoft: {
              ...providers.microsoft,
              tenantId: 'common',
              // Graph photos arrive as data URLs; the media module will handle uploads.
              disableProfilePhoto: true,
              // Entra ID emails are never treated as verified, except to allow an explicit
              // link from a signed-in account (the state then carries the link request).
              mapProfileToUser: async () => ({
                emailVerified: Boolean((await getOAuthState())?.link),
              }),
            },
          }
        : {}),
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL_SECONDS,
        allowedAttempts: 1,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }, ctx) => {
          const existing = await users.findByEmail(email.toLowerCase());
          const locale =
            existing?.locale ??
            negotiateLocale(
              headerOf(ctx as HookContext, 'accept-language'),
              await deps.locales.list(),
            );
          await scope.defer(() => mailer.sendMagicLink(email, locale, url));
        },
      }),
      twoFactor({ issuer: 'Pitchorium' }),
      ...(config.auth.turnstile
        ? [
            captcha({
              provider: 'cloudflare-turnstile',
              secretKey: config.auth.turnstile.secretKey,
              endpoints: CAPTCHA_PATHS,
            }),
          ]
        : []),
    ],
    rateLimit: {
      enabled: true,
      window: config.rateLimit.ttlMs / 1000,
      max: config.rateLimit.limit,
      customRules: Object.fromEntries(
        SENSITIVE_PATHS.map((path) => [
          path,
          { window: config.auth.rateLimit.windowSeconds, max: config.auth.rateLimit.max },
        ]),
      ),
      customStorage: new RedisRateLimitStorage(deps.redis),
    },
    onAPIError: { errorURL: `${config.webAppUrl}/auth/error` },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: config.auth.secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.auth.secureCookies,
      },
      ...(config.auth.cookieDomain
        ? { crossSubDomainCookies: { enabled: true, domain: config.auth.cookieDomain } }
        : {}),
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      database: { generateId: () => deps.ids.next() },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => ({
            data: {
              ...user,
              locale: negotiateLocale(
                headerOf(context as HookContext, 'accept-language'),
                await deps.locales.list(),
              ),
              // Sent by the web app (Intl.DateTimeFormat().resolvedOptions().timeZone).
              timeZone: timeZoneOrDefault(headerOf(context as HookContext, 'x-time-zone')),
            },
          }),
        },
      },
      // Identity events are recorded by withIdentityEvents, in the transaction of each write:
      // the `after` hooks below run once the write has committed and only send emails.
      session: {
        create: {
          after: async (session, context) => {
            const path = (context as HookContext | null)?.path;
            if (scope.current()?.registeredUserIds.has(session.userId)) return;
            // The sign-in that follows an email verification or a password change is not a new
            // device.
            if (path && SAME_DEVICE_SESSION_PATHS.has(path)) return;
            const device = (session.userAgent ?? '').slice(0, MAX_USER_AGENT_LENGTH) || 'unknown';
            const known = await users.otherSessionUserAgents(session.userId, session.id);
            if (known.some((agent) => agent.slice(0, MAX_USER_AGENT_LENGTH) === device)) return;
            const user = await users.findById(session.userId);
            if (!user) return;
            await scope.defer(() =>
              mailer.sendNewSignIn(
                { email: user.email, name: user.name, locale: user.locale },
                session.createdAt,
                device,
              ),
            );
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        await rejectCompromisedPassword(body[NEW_PASSWORD_FIELDS[ctx.path] ?? ''], ctx.path);
        // A password change always signs out the other sessions: it often follows a suspected
        // compromise, which other open sessions would survive.
        if (ctx.path === '/change-password') {
          return { context: { body: { ...body, revokeOtherSessions: true } } };
        }
        return undefined;
      }),
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
