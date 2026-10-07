import { errorCodeSchema, type ProblemDetails, problemDetailsSchema } from '@pitchorium/contracts';

export interface ApiClientOptions {
  /** Origin of the api, for example https://api.pitchorium.com. Empty for same-origin calls. */
  baseUrl: string;
  /** Headers added to every request (Accept-Language, authentication later). */
  headers?: () => Record<string, string>;
}

let options: ApiClientOptions = { baseUrl: '' };

export function configureApiClient(next: ApiClientOptions): void {
  options = next;
}

/** Thrown for every non-2xx response. Display `problem.code` through i18n, never `title`. */
export class ApiProblemError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(`${problem.status} ${problem.code}`);
    this.name = 'ApiProblemError';
  }
}

export type ErrorType<_Error> = ApiProblemError;

function fallbackProblem(status: number): ProblemDetails {
  const code = status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  return { type: 'about:blank', title: errorCodeSchema.parse(code), status, code };
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
  for (const [name, value] of Object.entries(options.headers?.() ?? {})) {
    if (!headers.has(name)) headers.set(name, value);
  }
  const response = await fetch(`${options.baseUrl}${url}`, {
    credentials: 'include',
    ...init,
    headers,
  });
  const body = await readBody(response);
  if (!response.ok) {
    const parsed = problemDetailsSchema.safeParse(body);
    throw new ApiProblemError(parsed.success ? parsed.data : fallbackProblem(response.status));
  }
  return body as T;
}
