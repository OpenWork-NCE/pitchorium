import 'server-only';
import { configureApiClient } from '@pitchorium/api-client';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { CLIENT_ADDRESS_HEADER, signClientAddress, visitorAddress } from './client-address';
import { serverApiOrigin } from './origin';

/**
 * Headers of the incoming request the api needs: the session cookie and the language, and the
 * signed address of the visitor (ADR 0115).
 */
const FORWARDED = ['cookie', 'accept-language'] as const;

export async function forwardedHeaders(): Promise<Record<string, string>> {
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
