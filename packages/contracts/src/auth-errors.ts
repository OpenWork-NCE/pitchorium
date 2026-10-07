import { type ErrorCode, errorCodes } from './errors/error-codes.js';

/**
 * Better Auth codes (BASE_ERROR_CODES and the two-factor plugin) that the /v1/auth routes in use
 * can answer, in the `code` field of `{ code, message }` or in the `error` parameter of a
 * redirect. Checked against Better Auth by a server unit test (ADR 0020).
 */
export const BETTER_AUTH_ERROR_CODES = [
  'USER_NOT_FOUND',
  'FAILED_TO_CREATE_USER',
  'FAILED_TO_CREATE_SESSION',
  'FAILED_TO_UPDATE_USER',
  'FAILED_TO_GET_SESSION',
  'INVALID_PASSWORD',
  'INVALID_EMAIL',
  'INVALID_EMAIL_OR_PASSWORD',
  'INVALID_USER',
  'SOCIAL_ACCOUNT_ALREADY_LINKED',
  'PROVIDER_NOT_FOUND',
  'INVALID_TOKEN',
  'TOKEN_EXPIRED',
  'FAILED_TO_GET_USER_INFO',
  'EMAIL_NOT_VERIFIED',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'USER_ALREADY_EXISTS',
  'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
  'CREDENTIAL_ACCOUNT_NOT_FOUND',
  'SESSION_EXPIRED',
  'FAILED_TO_UNLINK_LAST_ACCOUNT',
  'ACCOUNT_NOT_FOUND',
  'EMAIL_ALREADY_VERIFIED',
  'SESSION_NOT_FRESH',
  'LINKED_ACCOUNT_ALREADY_EXISTS',
  'INVALID_ORIGIN',
  'INVALID_CALLBACK_URL',
  'INVALID_REDIRECT_URL',
  'INVALID_ERROR_CALLBACK_URL',
  'MISSING_OR_NULL_ORIGIN',
  'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED',
  'VALIDATION_ERROR',
  'TOTP_NOT_ENABLED',
  'TOTP_ALREADY_ENABLED',
  'TWO_FACTOR_NOT_ENABLED',
  'INVALID_BACKUP_CODE',
  'INVALID_CODE',
  'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE',
  'ACCOUNT_TEMPORARILY_LOCKED',
  'INVALID_TWO_FACTOR_COOKIE',
] as const;

/** Codes added by Pitchorium on /v1/auth (password breach check). */
export const PITCHORIUM_AUTH_ERROR_CODES = [
  'PASSWORD_COMPROMISED',
  'PASSWORD_CHECK_FAILED',
] as const;

/**
 * Lower-case values of the `error` parameter of an OAuth callback or magic link redirect that
 * are not Better Auth API codes, upper-cased.
 */
export const AUTH_REDIRECT_ERROR_CODES = [
  'ACCOUNT_NOT_LINKED',
  'UNABLE_TO_LINK_ACCOUNT',
  'STATE_MISMATCH',
  'NEW_USER_SIGNUP_DISABLED',
  'INTERNAL_SERVER_ERROR',
] as const;

/** Every /v1/auth code with its own translation, under `errors.auth.<CODE>`. */
export const AUTH_ERROR_CODES = [
  ...BETTER_AUTH_ERROR_CODES,
  ...PITCHORIUM_AUTH_ERROR_CODES,
  ...AUTH_REDIRECT_ERROR_CODES,
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

const AUTH_CODES: ReadonlySet<string> = new Set(AUTH_ERROR_CODES);

/** Registry code standing for an unknown /v1/auth error, by HTTP status. */
export function authErrorFallback(status: number | undefined): ErrorCode {
  if (status === undefined || status >= 500) return 'INTERNAL_ERROR';
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION_FAILED';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'BAD_REQUEST';
  }
}

/**
 * Key of the `errors` i18n namespace for a /v1/auth error: the registry key when the code is a
 * registry code (ACCESS_ORIGIN_NOT_ALLOWED, INTERNAL_ERROR), `auth.<CODE>` for a known Better
 * Auth or redirect code (case-insensitive), the status fallback otherwise.
 */
export function authErrorTranslationKey(code: string | null | undefined, status?: number): string {
  const normalized = code?.toUpperCase();
  if (normalized && Object.hasOwn(errorCodes, normalized)) return normalized;
  if (normalized && AUTH_CODES.has(normalized)) return `auth.${normalized}`;
  return authErrorFallback(status);
}
