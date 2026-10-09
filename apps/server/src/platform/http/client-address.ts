import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

/**
 * Address of the visitor relayed by the server of the web app, which calls the api from its own
 * address when it renders a page (ADR 0115): `<address>;<milliseconds>;<base64url signature>`,
 * signed by HMAC-SHA256 with the secret shared by the web server and the api.
 */
export const CLIENT_ADDRESS_HEADER = 'x-pitchorium-client-address';

/** A relayed address is accepted for 30 seconds after its signature, 5 seconds ahead at most. */
export const CLIENT_ADDRESS_MAX_AGE_MS = 30_000;
const CLIENT_ADDRESS_MAX_SKEW_MS = 5_000;

const signature = (payload: string, secret: string): Buffer =>
  createHmac('sha256', secret).update(payload).digest();

/** Value of the header for an address signed now (the web server writes the same format). */
export function signClientAddress(address: string, secret: string, now: number): string {
  const payload = `${address};${now}`;
  return `${payload};${signature(payload, secret).toString('base64url')}`;
}

/**
 * The relayed address when the header is well formed, recent and validly signed; null
 * otherwise. Only the rate limiting reads it: nothing else trusts a relayed address.
 */
export function verifiedClientAddress(
  header: string | string[] | undefined,
  secret: string,
  now: number,
): string | null {
  if (typeof header !== 'string' || header.length > 256) return null;
  const parts = header.split(';');
  if (parts.length !== 3) return null;
  const [address, stamp, given] = parts as [string, string, string];
  if (isIP(address) === 0 || !/^\d{1,15}$/.test(stamp)) return null;
  const age = now - Number(stamp);
  if (age > CLIENT_ADDRESS_MAX_AGE_MS || age < -CLIENT_ADDRESS_MAX_SKEW_MS) return null;
  const expected = signature(`${address};${stamp}`, secret);
  const received = Buffer.from(given, 'base64url');
  return received.length === expected.length && timingSafeEqual(received, expected)
    ? address
    : null;
}
