import 'server-only';
import { type ApiRequestInfo, configureApiClient } from '@pitchorium/api-client';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { CLIENT_ADDRESS_HEADER, signClientAddress, visitorAddress } from './client-address';
import { serverApiOrigin } from './origin';

/**
 * Headers of the incoming request the api needs: the session cookie and the language, and the
 * signed address of the visitor (ADR 0115).
 */
const FORWARDED = ['cookie', 'accept-language'] as const;

export async function forwardedHeaders(request?: ApiRequestInfo): Promise<Record<string, string>> {
  // A read shared by every reader carries nothing of the one who asked (sharedRead).
  if (request?.headers.has(SHARED_READ_HEADER)) return {};
  const incoming = await headers();
  const forwarded: Record<string, string> = {};
  for (const name of FORWARDED) {
    const value = incoming.get(name);
    if (value) forwarded[name] = value;
  }
  // The api counts a visitor by this address rather than by the address of this server.
  const secret = env.WEB_CLIENT_ADDRESS_SECRET;
  const address = visitorAddress(incoming.get('x-forwarded-for'), env.WEB_TRUST_PROXY_HOPS);
  if (secret && address) {
    forwarded[CLIENT_ADDRESS_HEADER] = signClientAddress(address, secret, Date.now());
  }
  return forwarded;
}

/** Marks a read whose answer is the same for every reader (sharedRead). */
export const SHARED_READ_HEADER = 'x-pitchorium-shared-read';

/**
 * Options of a public read whose answer depends on no reader (featured projects, coverage, legal
 * versions, reference data, the public lists of the sitemap): kept `seconds` in the data cache of
 * Next.js. The cache key of a fetch holds its headers: forwarding the cookie, the language or the
 * signed address of the visitor (dated) would give each request its own key, and the cache would
 * never answer. Such a read goes without them.
 */
export function sharedRead(seconds: number): RequestInit {
  return { next: { revalidate: seconds }, headers: { [SHARED_READ_HEADER]: '1' } };
}

let configured = false;

/**
 * Configures the generated client for Server Components: internal origin of the api and the
 * cookies of the incoming request (read per request by `next/headers`). The browser
 * configuration (browser.ts) never runs on the server.
 */
export function configureServerApi(): void {
  if (configured) return;
  configureApiClient({ baseUrl: serverApiOrigin(), headers: forwardedHeaders });
  configured = true;
}
