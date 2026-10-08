'use client';

import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  indexedDbStore,
  registerPersistedMutations,
  restore,
  save,
} from '@/lib/query/persisted-mutations';

/**
 * Keeps the writes made offline across the closing of the tab (ADR 0102): restores the actions
 * the member left waiting, replays them once online, and writes the paused ones to the device
 * whenever a mutation changes. Mounted by the member space, for its member only.
 */
export function PersistedMutations({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient();
  useEffect(() => {
    registerPersistedMutations(queryClient);
    let cancelled = false;
    // Nothing is written before the restore: an empty save would erase what waits on the device.
    let restored = false;
    void restore(queryClient, indexedDbStore, memberId).then((count) => {
      if (cancelled) return;
      restored = true;
      if (count > 0 && onlineManager.isOnline()) void queryClient.resumePausedMutations();
    });
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      if (restored) void save(queryClient, indexedDbStore, memberId);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [queryClient, memberId]);
  return null;
}
