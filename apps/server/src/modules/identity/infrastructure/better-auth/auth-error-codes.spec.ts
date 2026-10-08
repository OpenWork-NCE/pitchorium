import {
  AUTH_ERROR_CODES,
  authErrorTranslationKey,
  BETTER_AUTH_ERROR_CODES,
  CAPTCHA_AUTH_ERROR_CODES,
} from '@pitchorium/contracts';
import { BASE_ERROR_CODES } from 'better-auth';
import { captcha, TWO_FACTOR_ERROR_CODES } from 'better-auth/plugins';
import { describe, expect, it } from 'vitest';

describe('/v1/auth error codes (ADR 0020)', () => {
  it('lists only codes that Better Auth defines, so that an upgrade cannot rename one silently', () => {
    const defined = new Set([
      ...Object.keys(BASE_ERROR_CODES),
      ...Object.keys(TWO_FACTOR_ERROR_CODES),
    ]);
    expect(BETTER_AUTH_ERROR_CODES.filter((code) => !defined.has(code))).toEqual([]);
  });

  it('lists the codes of the captcha plugin (Turnstile)', () => {
    const plugin = captcha({ provider: 'cloudflare-turnstile', secretKey: 'unused' });
    expect([...CAPTCHA_AUTH_ERROR_CODES].sort()).toEqual(Object.keys(plugin.$ERROR_CODES).sort());
  });

  it('resolves registry codes, auth codes in any case, then the status fallback', () => {
    expect(authErrorTranslationKey('ACCESS_ORIGIN_NOT_ALLOWED', 403)).toBe(
      'ACCESS_ORIGIN_NOT_ALLOWED',
    );
    expect(authErrorTranslationKey('account_not_linked')).toBe('auth.ACCOUNT_NOT_LINKED');
    expect(authErrorTranslationKey('PASSWORD_TOO_SHORT', 400)).toBe('auth.PASSWORD_TOO_SHORT');
    expect(authErrorTranslationKey(undefined, 429)).toBe('RATE_LIMITED');
    expect(authErrorTranslationKey('NOT_LISTED_YET', 400)).toBe('BAD_REQUEST');
    expect(authErrorTranslationKey(null, 502)).toBe('INTERNAL_ERROR');
    expect(new Set(AUTH_ERROR_CODES).size).toBe(AUTH_ERROR_CODES.length);
  });
});
