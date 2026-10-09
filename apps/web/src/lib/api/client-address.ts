// Namespaces, read when called: Storybook evaluates the server modules a feature exports
// without calling them, and Vite refuses any named binding of a Node module in a browser.
import * as crypto from 'node:crypto';
import * as net from 'node:net';

/** Header of the visitor address relayed to the api for its rate limiting (ADR 0115). */
export const CLIENT_ADDRESS_HEADER = 'x-pitchorium-client-address';

/**
 * Address of the visitor in `X-Forwarded-For`, behind `hops` trusted proxies: the address the
 * outermost of them saw, the hops-th from the right (as `trust proxy` of Express). None without a
 * trusted proxy: Next.js writes the header only when the client did not, so it proves nothing.
 */
export function visitorAddress(forwardedFor: string | null, hops: number): string | null {
  if (!forwardedFor || hops < 1) return null;
  const addresses = forwardedFor.split(',').map((entry) => entry.trim());
  const address = addresses[addresses.length - hops];
  return address && net.isIP(address) !== 0 ? address : null;
}

/** `<address>;<milliseconds>;<base64url HMAC-SHA256>`, as the api verifies it. */
export function signClientAddress(address: string, secret: string, now: number): string {
  const payload = `${address};${now}`;
  return `${payload};${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
