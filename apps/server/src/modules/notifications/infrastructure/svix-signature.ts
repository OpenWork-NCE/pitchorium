import { createHmac, timingSafeEqual } from 'node:crypto';

/** Tolerance of the signature timestamp, as the Svix libraries (5 minutes). */
export const SVIX_TOLERANCE_SECONDS = 300;

/** Signature of a Svix webhook (Resend): base64 HMAC SHA-256 of `id.timestamp.body`. */
export function svixSignature(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

/**
 * Checks `svix-id`, `svix-timestamp` and `svix-signature` (`v1,<base64>` entries separated by
 * spaces) on the raw body (docs.svix.com, manual verification).
 */
export function verifySvix(
  secret: string,
  headers: Record<string, string | undefined>,
  body: Buffer,
  now: Date,
): { id: string } | null {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return null;
  if (Math.abs(now.getTime() / 1000 - Number(timestamp)) > SVIX_TOLERANCE_SECONDS) return null;
  const expected = Buffer.from(svixSignature(secret, id, timestamp, body.toString('utf8')));
  const valid = signatures.split(' ').some((entry) => {
    const [version, signature] = entry.split(',', 2);
    const given = Buffer.from(signature ?? '');
    return version === 'v1' && given.length === expected.length && timingSafeEqual(given, expected);
  });
  return valid ? { id } : null;
}
