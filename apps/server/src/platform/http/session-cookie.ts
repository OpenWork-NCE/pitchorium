import { createHmac, timingSafeEqual } from 'node:crypto';

/** Prefix of the cookies of Better Auth (identity module): `<prefix>.session_token`. */
export const SESSION_COOKIE_PREFIX = 'pitchorium';

const SESSION_COOKIE = new RegExp(
  `(?:^|;\\s*)(?:__Secure-)?${SESSION_COOKIE_PREFIX}\\.session_token=([^;]+)`,
);

/**
 * Token of the session cookie when its signature is valid (HMAC-SHA256 of the token with the
 * secret of the authentication, `<token>.<base64 signature>`, URL-encoded as Better Auth writes
 * it); null otherwise. A forged cookie never passes: it costs a hash, never a lookup.
 */
export function signedSessionToken(
  cookieHeader: string | undefined,
  secret: string,
): string | null {
  const raw = SESSION_COOKIE.exec(cookieHeader ?? '')?.[1];
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const token = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), 'base64');
  const expected = createHmac('sha256', secret).update(token).digest();
  return given.length === expected.length && timingSafeEqual(given, expected) ? token : null;
}
