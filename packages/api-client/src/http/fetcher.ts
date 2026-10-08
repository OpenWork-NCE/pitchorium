import type { ProblemDetails } from '@pitchorium/contracts';

/** What a header provider knows about the request being sent. */
export interface ApiRequestInfo {
  /** Upper-case HTTP method. */
  method: string;
  /** Path and query, without the origin (`/v1/me`). */
  url: string;
  /** Headers already set by the caller: a provider does not override them. */
  headers: Headers;
}

export interface ApiClientOptions {
  /** Origin of the api, for example https://api.pitchorium.com. Empty for same-origin calls. */
  baseUrl: string;
  /**
   * Headers added to every request (Accept-Language, Idempotency-Key, forwarded cookies on the
   * server). May be asynchronous; never overrides a header set by the caller.
   */
  headers?: (request: ApiRequestInfo) => Record<string, string> | Promise<Record<string, string>>;
}

let options: ApiClientOptions = { baseUrl: '' };

export function configureApiClient(next: ApiClientOptions): void {
  options = next;
}

/** Thrown for every non-2xx response. Display `problem.code` through i18n, never `title`. */
export class ApiProblemError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    /** `X-Request-Id` of the response, to quote in a bug report. */
    readonly requestId: string | null = null,
  ) {
    super(`${problem.status} ${problem.code}`);
    this.name = 'ApiProblemError';
  }
}

export type ErrorType<_Error> = ApiProblemError;

function fallbackProblem(status: number): ProblemDetails {
  const code = status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  return { type: 'about:blank', title: code, status, code };
}

/**
 * Shape of an RFC 9457 document of the api. Checked by hand rather than with the Zod schema of
 * the contracts: the client stays free of a validation library in the browser bundles.
 */
function isProblem(body: unknown): body is ProblemDetails {
  if (typeof body !== 'object' || body === null) return false;
  const { type, title, status, code } = body as Record<string, unknown>;
  return (
    typeof type === 'string' &&
    typeof title === 'string' &&
    typeof status === 'number' &&
    typeof code === 'string'
  );
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Mutator used by the generated client (see orval.config.ts). */
export async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  const extra = (await options.headers?.({ method, url, headers })) ?? {};
  for (const [name, value] of Object.entries(extra)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  const response = await fetch(`${options.baseUrl}${url}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiProblemError(
      isProblem(body) ? body : fallbackProblem(response.status),
      response.headers.get('x-request-id'),
    );
  }
  return body as T;
}
