import 'server-only';
import { headers } from 'next/headers';

/** CSP nonce of the request, set by the proxy (ADR 0088); undefined outside a proxied request. */
export async function requestNonce(): Promise<string | undefined> {
  return (await headers()).get('x-nonce') ?? undefined;
}
