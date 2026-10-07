import { createHash } from 'node:crypto';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
/** Bounds the delay a slow service adds to a sign-up, since the check then fails open. */
export const PWNED_CHECK_TIMEOUT_MS = 3000;

/** Why the service gave no usable answer. */
export type PwnedCheckFailure = 'timeout' | 'unreachable' | 'http_error';

export type PwnedCheckResult =
  | { status: 'compromised' }
  | { status: 'clean' }
  | { status: 'unavailable'; reason: PwnedCheckFailure; detail: string };

export interface PwnedCheckOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/**
 * Have I Been Pwned range API with k-anonymity: only the first five characters of the SHA-1 hash
 * leave the server, and padding hides the size of the answer. Never throws: a service that does
 * not answer, answers too slowly or answers an error gives `unavailable`, and the caller decides
 * (sign-up fails open, ADR 0019).
 */
export async function checkPwnedPassword(
  password: string,
  options: PwnedCheckOptions = {},
): Promise<PwnedCheckResult> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const suffix = hash.slice(5);
  const fetcher = options.fetch ?? globalThis.fetch;
  let body: string;
  try {
    const response = await fetcher(`${RANGE_URL}${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': 'Pitchorium' },
      signal: AbortSignal.timeout(options.timeoutMs ?? PWNED_CHECK_TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { status: 'unavailable', reason: 'http_error', detail: `HTTP ${response.status}` };
    }
    body = await response.text();
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      status: 'unavailable',
      reason: timedOut ? 'timeout' : 'unreachable',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
  const compromised = body.split(/\r?\n/).some((line) => {
    const [candidate, count] = line.split(':');
    return candidate?.toUpperCase() === suffix && Number(count) > 0;
  });
  return { status: compromised ? 'compromised' : 'clean' };
}
