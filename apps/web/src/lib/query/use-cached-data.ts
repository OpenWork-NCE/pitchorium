'use client';

import {
  hashKey,
  type QueryCacheNotifyEvent,
  type QueryKey,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Data the server already read for the first render, kept in the cache of TanStack Query and read
 * from it without a query observer (ADR 0094): the member shell and the islands of the pages of
 * resources are chunks loaded side by side, and the observer of `useQuery` was copied into each.
 * Writes to the cache (realtime, optimistic changes) show at once; an invalidated entry is read
 * again from the api, as are data the server could not give. The entry is never collected while
 * the page lives: nothing observes it to keep it.
 */
export function useCachedData<Data>({
  queryKey,
  queryFn,
  initialData,
  staleTime = Infinity,
}: {
  queryKey: QueryKey;
  queryFn: (context: { signal: AbortSignal }) => Promise<Data>;
  /** What the server read; null when it could not. */
  initialData: Data | null;
  /** Read again when a reader mounts and the entry is older, as `useQuery` does. */
  staleTime?: number;
}): Data | undefined {
  const queryClient = useQueryClient();
  const hash = hashKey(queryKey);
  useState(() => {
    queryClient.setQueryDefaults(queryKey, { gcTime: Infinity });
    if (initialData !== null && queryClient.getQueryData(queryKey) === undefined) {
      queryClient.setQueryData(queryKey, initialData);
    }
  });
  const read = useCallback(
    () => void queryClient.fetchQuery({ queryKey, queryFn }).catch(() => undefined),
    // The key and the function of a mounted reader do not change: its hash names the entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, hash],
  );
  const subscribe = useCallback(
    (changed: () => void) =>
      queryClient.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
        if (event.query.queryHash !== hash) return;
        if (event.type === 'updated' && event.action.type === 'invalidate') read();
        changed();
      }),
    [queryClient, hash, read],
  );
  const data = useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryData<Data>(queryKey),
    () => initialData ?? undefined,
  );
  useEffect(() => {
    const state = queryClient.getQueryState(queryKey);
    if (state?.data === undefined || Date.now() - state.dataUpdatedAt > staleTime) read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, hash, read]);
  return data;
}
