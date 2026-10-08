import { configureApiClient, type ApiRequestInfo } from '@pitchorium/api-client';
import { publicEnv } from '@/lib/public-env';

/**
 * Headers of the browser calls: the session cookie travels by itself (credentials: include),
 * the interface language goes as Accept-Language and every POST carries an Idempotency-Key
 * unless the caller provides the key of its intention (frontend handoff).
 */
export function browserHeaders({ method, headers }: ApiRequestInfo): Record<string, string> {
  const extra: Record<string, string> = {};
  const language = document.documentElement.lang;
  if (language) extra['Accept-Language'] = language;
  if (method === 'POST' && !headers.has('Idempotency-Key')) {
    extra['Idempotency-Key'] = crypto.randomUUID();
  }
  return extra;
}

/** Configures the generated client for the browser; a no-op on the server. */
export function configureBrowserApi(): void {
  if (typeof window === 'undefined') return;
  configureApiClient({ baseUrl: publicEnv.apiUrl, headers: browserHeaders });
}
