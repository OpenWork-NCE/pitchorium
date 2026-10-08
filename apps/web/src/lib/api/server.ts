import 'server-only';
import { configureApiClient } from '@pitchorium/api-client';
import { headers } from 'next/headers';
import { serverApiOrigin } from './origin';

/** Headers of the incoming request the api needs: the session cookie and the language. */
const FORWARDED = ['cookie', 'accept-language'] as const;

export async function forwardedHeaders(): Promise<Record<string, string>> {
  const incoming = await headers();
  const forwarded: Record<string, string> = {};
  for (const name of FORWARDED) {
    const value = incoming.get(name);
    if (value) forwarded[name] = value;
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
