'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { idle } from '@/lib/preload';

/**
 * Realtime channel of the member space: the connection (Socket.IO, realtime-connection.ts) loads
 * after the first render, the schemas of the payloads with the first event; the events write the
 * counters to the cache and invalidate what changed. Mounted by the member space only.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    // The counters of the first view come with the page: the channel opens once it is idle.
    void idle()
      .then(() => import('./realtime-connection'))
      .then(({ connect }) => {
        if (!cancelled) disconnect = connect(queryClient);
      });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [queryClient]);
  return children;
}
