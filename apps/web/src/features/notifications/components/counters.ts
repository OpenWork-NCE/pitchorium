'use client';

import {
  type CountersDtoOutput,
  notificationsControllerCounters,
  notificationsControllerReadAll,
} from '@pitchorium/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useIdempotentMutation } from '@/lib/query/offline';
import { COUNTERS_QUERY_KEY } from '@/lib/query/keys';
import { useCachedData } from '@/lib/query/use-cached-data';

const fetchCounters = ({ signal }: { signal: AbortSignal }) =>
  notificationsControllerCounters({ signal });

/**
 * Counters of the member (`GET /v1/me/counters`): read by the server for the first render, then
 * written as they are by the realtime channel (`counters` event, lib/realtime) and read again
 * after a reconnection or an invalidation, without a query observer (`useCachedData`).
 */
export function useCounters(initial: CountersDtoOutput | null): {
  data: CountersDtoOutput | undefined;
} {
  return {
    data: useCachedData({
      queryKey: COUNTERS_QUERY_KEY,
      queryFn: fetchCounters,
      initialData: initial,
    }),
  };
}

/**
 * Marks every notification as read (`POST /v1/me/notifications/read-all`). Done offline, it waits
 * for the network and goes once, with the key of the intention (ADR 0097).
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useIdempotentMutation({
    mutationKey: ['notifications', 'read-all'],
    mutationFn: (_input: void, request) => notificationsControllerReadAll(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: COUNTERS_QUERY_KEY }),
  });
}
