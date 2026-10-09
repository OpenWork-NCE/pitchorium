import { authErrorFallback } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Header of the Turnstile token on the /v1/auth routes (ADR 0103). */
export const CAPTCHA_HEADER = 'x-captcha-response';

/** A refused call of /v1/auth: its Better Auth code, its status and the wait before a retry. */
export interface AuthFailure {
  code: string | undefined;
  status: number;
  /** Seconds before a new attempt, after a rate limit (`X-Retry-After`). */
  retryAfter: number | null;
}

export type AuthOutcome<T> = { ok: true; data: T } | { ok: false; failure: AuthFailure };

/** Fetch options handed to a call of the Better Auth client. */
export interface AuthFetchOptions {
  headers: Record<string, string>;
  onError: (context: { response: Response }) => void;
}

interface AuthClientResult {
  data: unknown;
  error: { status: number; code?: string | undefined } | null;
}

/**
 * Runs a call of the Better Auth client: the Turnstile token goes in its header, the wait of a
 * rate limit is read from the response, a network failure becomes status 0. The client never
 * throws for an answer of the api: the caller reads `ok`.
 */
export async function authCall<T = unknown>(
  run: (options: AuthFetchOptions) => Promise<AuthClientResult>,
  captcha?: string | null,
): Promise<AuthOutcome<T>> {
  let retryAfter: number | null = null;
  try {
    const result = await run({
      headers: captcha ? { [CAPTCHA_HEADER]: captcha } : {},
      onError: ({ response }) => {
        const value = Number(
          response.headers.get('X-Retry-After') ?? response.headers.get('Retry-After'),
        );
        retryAfter = Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
      },
    });
    if (result.error) {
      return {
        ok: false,
        failure: { code: result.error.code, status: result.error.status, retryAfter },
      };
    }
    return { ok: true, data: result.data as T };
  } catch {
    return { ok: false, failure: { code: undefined, status: 0, retryAfter: null } };
  }
}

/**
 * Text of a refused call: the wait of a rate limit with its delay, the network, or the code
 * translated (`errors.auth.<CODE>`, ADR 0020). The texts never say whether an account exists.
 */
export function useAuthFailureMessage(): (failure: AuthFailure) => string {
  const errors = useTranslations('errors');
  const t = useTranslations('web.auth.failures');
  return useCallback(
    (failure: AuthFailure) => {
      if (failure.status === 429) {
        return failure.retryAfter
          ? t('rateLimited', { seconds: failure.retryAfter })
          : t('rateLimitedShort');
      }
      if (failure.status === 0) return t('network');
      // As authErrorTranslationKey (ADR 0020), read from the catalogue rather than from the
      // registry of codes, which stays out of the sign-in screens (ADR 0094).
      type Key = Parameters<typeof errors>[0];
      const code = failure.code?.toUpperCase();
      for (const key of code ? [code, `auth.${code}`] : []) {
        if (errors.has(key as Key)) return errors(key as Key);
      }
      const fallback = authErrorFallback(failure.status);
      return errors.has(fallback) ? errors(fallback) : t('unexpected');
    },
    [errors, t],
  );
}
