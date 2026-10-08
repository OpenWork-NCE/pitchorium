import { ApiProblemError } from '@pitchorium/api-client';
import { defaultShouldDehydrateQuery, isServer, QueryClient } from '@tanstack/react-query';

/** A client error (4xx) will not change on a retry: only network and server errors retry. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiProblemError && error.problem.status < 500) return false;
  return failureCount < 2;
}

/**
 * Defaults of every query (docs/architecture/frontend.md): data fresh for a minute, so that the
 * hydrated server data is not fetched again at once; no refetch on focus, the realtime channel
 * invalidates what changes; mutations never retry by themselves (Idempotency-Key of the intention).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
      dehydrate: {
        // Pending queries are streamed to the browser too (prefetch without await).
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One client per request on the server, one for the page lifetime in the browser. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
