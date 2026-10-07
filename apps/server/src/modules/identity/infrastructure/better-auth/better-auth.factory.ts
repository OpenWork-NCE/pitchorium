import { Logger } from '@nestjs/common';
import { DEFAULT_LOCALE } from '@pitchorium/contracts';
import {
  identityAccounts,
  identitySessions,
  identityTwoFactors,
  identityUsers,
  identityVerifications,
} from '@pitchorium/db/schemas/identity';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, getOAuthState } from 'better-auth/api';
import { haveIBeenPwned, magicLink, twoFactor } from 'better-auth/plugins';
import type { Redis } from 'ioredis';
import type { ApiConfig } from '../../../../platform/config';
import type { TransactionManager } from '../../../../platform/database';
import type { IdGenerator } from '../../../../platform/kernel';
import type { ActiveLocalesService } from '../../application/active-locales.service';
import type { IdentityEventsRecorder } from '../../application/identity-events.recorder';
import type { IdentityUserRepository } from '../../application/identity-user.repository';
import type { RegistrationMethod, SessionRevocationScope } from '../../domain/identity-events';
import { negotiateLocale } from '../../domain/locale-negotiation';
import {
  EMAIL_VERIFICATION_TTL_SECONDS,
  type IdentityMailer,
  MAGIC_LINK_TTL_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
} from '../identity-mailer';
import type { AuthRequestScope } from './auth-request-scope';
import { RedisRateLimitStorage } from './redis-rate-limit.storage';
import { transactionalDatabase } from './transactional-database';

export const AUTH_BASE_PATH = '/v1/auth';
export const AUTH_COOKIE_PREFIX = 'pitchorium';
/** Set by the HTTP handler from the Express client IP (honours TRUST_PROXY_HOPS). */
export const CLIENT_IP_HEADER = 'x-pitchorium-client-ip';

const SESSION_TTL_SECONDS = 30 * 24 * 3600;
const SESSION_REFRESH_AFTER_SECONDS = 24 * 3600;
const MAX_USER_AGENT_LENGTH = 200;

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

const REVOCATION_PATHS: Readonly<Record<string, SessionRevocationScope>> = {
  '/revoke-session': 'one',
  '/revoke-other-sessions': 'others',
  '/revoke-sessions': 'all',
};

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
}

interface HookContext {
  path?: string;
  params?: Record<string, string>;
  headers?: Headers;
  request?: Request;
}

function headerOf(context: HookContext | null | undefined, name: string): string | null {
  return context?.headers?.get(name) ?? context?.request?.headers.get(name) ?? null;
}

function registrationMethod(context: HookContext | null | undefined): RegistrationMethod {
  if (context?.path?.startsWith('/callback/')) {
    const provider = context.params?.['id'];
    if (provider === 'google' || provider === 'linkedin' || provider === 'microsoft') {
      return provider;
    }
  }
  if (context?.path === '/magic-link/verify') return 'magic_link';
  return 'credential';
}

/**
 * Better Auth configuration. Linking policy (ADR 0014): Google and LinkedIn link implicitly only
 * when the provider asserts a verified email and the local email is verified too; Microsoft never
 * links implicitly, because Entra ID lets tenants assert arbitrary emails.
 */
export function createBetterAuth(deps: BetterAuthDependencies) {
  const { config, scope, users, events, mailer } = deps;
  const logger = new Logger('BetterAuth');
  const { providers } = config.auth;

  const recipient = async (user: { id: string; email: string; name: string }) => {
    const stored = await users.findById(user.id);
    return { email: user.email, name: user.name, locale: stored?.locale ?? DEFAULT_LOCALE };
  };

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
    database: drizzleAdapter(transactionalDatabase(deps.transactions), {
      provider: 'pg',
      schema: {
        user: identityUsers,
        session: identitySessions,
        account: identityAccounts,
        verification: identityVerifications,
        twoFactor: identityTwoFactors,
      },
    }),
    user: {
      additionalFields: {
        // Not returned: the generic answer to a duplicate sign-up has no negotiated locale, so
        // returning it would reveal that the account exists. Read it from GET /v1/me.
        locale: { type: 'string', required: false, input: false, returned: false },
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
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Without auto sign-in, signing up with a known email answers like a new sign-up.
      autoSignIn: false,
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        await events.passwordChanged(user.id, 'reset');
        await events.sessionsRevoked(user.id, 'all', 'password_reset');
      },
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
      haveIBeenPwned({
        enabled: config.auth.pwnedPasswordCheck,
        paths: ['/sign-up/email', '/change-password', '/reset-password', '/set-password'],
      }),
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
            },
          }),
          after: async (user, context) => {
            scope.current()?.registeredUserIds.add(user.id);
            const stored = await users.findById(user.id);
            await events.userRegistered(user.id, {
              method: registrationMethod(context as HookContext),
              locale: stored?.locale ?? DEFAULT_LOCALE,
              emailVerified: user.emailVerified,
            });
            if (user.emailVerified) await events.emailVerified(user.id);
          },
        },
        update: {
          // Better Auth only writes emailVerified=true when the email was not verified yet.
          before: (data) => {
            const state = scope.current();
            if (state && data.emailVerified === true) state.pendingEmailVerification = true;
            return Promise.resolve();
          },
          after: async (user) => {
            const state = scope.current();
            if (state?.pendingEmailVerification && user.emailVerified) {
              state.pendingEmailVerification = false;
              await events.emailVerified(user.id);
            }
          },
        },
      },
      account: {
        create: {
          after: async (account) => {
            if (scope.current()?.registeredUserIds.has(account.userId)) return;
            await events.accountLinked(account.userId, account.providerId);
          },
        },
        delete: {
          after: async (account) => {
            await events.accountUnlinked(account.userId, account.providerId);
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            const path = (context as HookContext | null)?.path;
            if (scope.current()?.registeredUserIds.has(session.userId)) return;
            // The automatic sign-in that follows an email verification is not a new device.
            if (path === '/verify-email') return;
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
      after: createAuthMiddleware(async (ctx) => {
        const userId = ctx.context.session?.user.id;
        if (!userId || ctx.context.returned instanceof Error) return;
        if (ctx.path === '/change-password') {
          await events.passwordChanged(userId, 'changed');
          const body = ctx.body as { revokeOtherSessions?: boolean } | undefined;
          if (body?.revokeOtherSessions) {
            await events.sessionsRevoked(userId, 'others', 'user_request');
          }
          return;
        }
        const scopeOfPath = REVOCATION_PATHS[ctx.path];
        if (scopeOfPath) await events.sessionsRevoked(userId, scopeOfPath, 'user_request');
      }),
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
