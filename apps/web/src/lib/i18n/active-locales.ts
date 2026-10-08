import 'server-only';
import { type ActiveLocales, activeLocalesSchema, DEFAULT_LOCALE } from '@pitchorium/contracts';
import { serverApiOrigin } from '@/lib/api/origin';

/** Same lifetime as the shared cache the api announces on `GET /v1/locales`. */
const TTL_MS = 60_000;
const TIMEOUT_MS = 1_500;

/** Without an answer from the api, only the source locale is offered (§4: absent rather than wrong). */
export const FALLBACK_ACTIVE_LOCALES: ActiveLocales = {
  defaultLocale: DEFAULT_LOCALE,
  locales: [DEFAULT_LOCALE],
};

let cached: { value: ActiveLocales; expiresAt: number } | undefined;
let pending: Promise<ActiveLocales> | undefined;

async function load(): Promise<ActiveLocales> {
  try {
    const response = await fetch(`${serverApiOrigin()}/v1/locales`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GET /v1/locales answered ${response.status}`);
    const value = activeLocalesSchema.parse(await response.json());
    cached = { value, expiresAt: Date.now() + TTL_MS };
    return value;
  } catch {
    // The last known answer stays valid while the api is unreachable.
    return cached?.value ?? FALLBACK_ACTIVE_LOCALES;
  } finally {
    pending = undefined;
  }
}

/** Interface locales enabled by their feature flag (ADR 0077), cached for a minute per process. */
export function getActiveLocales(): Promise<ActiveLocales> {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  pending ??= load();
  return pending;
}
