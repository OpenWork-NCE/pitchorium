'use client';

import {
  type CountersDtoOutput,
  getNotificationsControllerCountersQueryKey,
  notificationsControllerCounters,
  notificationsControllerReadAll,
} from '@pitchorium/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIdempotentMutation } from '@/lib/query/offline';

/**
 * Counters of the member (`GET /v1/me/counters`): read by the server for the first render, then
 * written as they are by the realtime channel (`counters` event, lib/realtime) and read again
 * after a reconnection.
 */
export function useCounters(initial: CountersDtoOutput | null) {
  return useQuery({
    queryKey: getNotificationsControllerCountersQueryKey(),
    queryFn: ({ signal }) => notificationsControllerCounters({ signal }),
    initialData: initial ?? undefined,
  });
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: getNotificationsControllerCountersQueryKey() }),
  });
}
