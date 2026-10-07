import { timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../platform/kernel';

export const PROVIDER_TIMEOUT_MS = 15_000;

/** A JSON value whose numbers are kept as their source text: amounts are never floats. */
export type ExactJson = string | boolean | null | ExactJson[] | { [key: string]: ExactJson };

/** Parses JSON keeping every number as its exact source text (`100.50` stays `"100.50"`). */
export function parseExactJson(text: string): ExactJson {
  return JSON.parse(text, (_key, value: unknown, context?: { source?: string }) =>
    typeof value === 'number' ? (context?.source ?? String(value)) : value,
  ) as ExactJson;
}

/** A decimal number written as is in a JSON body, never through a float. */
export class DecimalLiteral {
  constructor(readonly text: string) {
    if (!/^-?(0|[1-9]\d*)(\.\d+)?$/.test(text)) throw new Error(`Invalid decimal: ${text}`);
  }
}

const DECIMAL_MARK = '__pitchorium_decimal__:';

/** JSON.stringify, with DecimalLiteral values written as numeric literals. */
export function stringifyWithDecimals(value: unknown): string {
  const json = JSON.stringify(value, (_key, candidate: unknown) =>
    candidate instanceof DecimalLiteral ? `${DECIMAL_MARK}${candidate.text}` : candidate,
  );
  return json.replace(new RegExp(`"${DECIMAL_MARK}(-?[0-9.]+)"`, 'g'), '$1');
}

/** Reads a nested field of an exact JSON value; undefined when absent. */
export function field(
  value: ExactJson | undefined,
  ...path: (string | number)[]
): ExactJson | undefined {
  let current: ExactJson | undefined = value;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = Array.isArray(current)
      ? typeof key === 'number'
        ? current[key]
        : undefined
      : (current as Record<string, ExactJson>)[String(key)];
  }
  return current;
}

export function text(value: ExactJson | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

export function list(value: ExactJson | undefined): ExactJson[] {
  return Array.isArray(value) ? value : [];
}

export function unavailable(provider: string, detail: string): DomainError {
  return new DomainError('PAYMENTS_PROVIDER_UNAVAILABLE', `${provider}: ${detail}`);
}

/**
 * Calls a provider API: a network error, a timeout or a 5xx answers PAYMENTS_PROVIDER_UNAVAILABLE;
 * a 4xx is returned to the adapter with its body.
 */
export async function callProvider(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: ExactJson }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    throw unavailable(provider, error instanceof Error ? error.message : 'network error');
  }
  const raw = await response.text();
  if (response.status >= 500) throw unavailable(provider, `HTTP ${response.status}`);
  try {
    return { status: response.status, body: raw ? parseExactJson(raw) : null };
  } catch {
    throw unavailable(provider, `invalid JSON (HTTP ${response.status})`);
  }
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
