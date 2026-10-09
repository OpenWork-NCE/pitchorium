import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signedSessionToken } from './session-cookie';

const SECRET = 'a-secret-of-the-tests-long-enough';
const signed = (token: string, secret = SECRET) =>
  encodeURIComponent(`${token}.${createHmac('sha256', secret).update(token).digest('base64')}`);

describe('signed session cookie', () => {
  it('reads the token of a cookie signed with the secret', () => {
    expect(
      signedSessionToken(`theme=dark; pitchorium.session_token=${signed('abc')}`, SECRET),
    ).toBe('abc');
    expect(signedSessionToken(`__Secure-pitchorium.session_token=${signed('xyz')}`, SECRET)).toBe(
      'xyz',
    );
  });

  it('refuses a missing, unsigned or forged cookie', () => {
    expect(signedSessionToken(undefined, SECRET)).toBeNull();
    expect(signedSessionToken('pitchorium.session_token=abc', SECRET)).toBeNull();
    expect(
      signedSessionToken(`pitchorium.session_token=${signed('abc', 'another')}`, SECRET),
    ).toBeNull();
    expect(signedSessionToken('pitchorium.session_token=%E0%A4%A', SECRET)).toBeNull();
  });
});
