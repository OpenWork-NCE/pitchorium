'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';

/**
 * Realtime channel of the member space: the connection (Socket.IO and the schemas of its
 * payloads, realtime-connection.ts) loads after the first render, then writes the counters to
 * the cache and invalidates what changed. Mounted by the member space only.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    void import('./realtime-connection').then(({ connect }) => {
      if (!cancelled) disconnect = connect(queryClient);
    });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [queryClient]);
  return children;
}
