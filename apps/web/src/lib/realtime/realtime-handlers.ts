import '@/lib/zod';

import { getMessagingControllerListQueryKey } from '@pitchorium/api-client';
import {
  SERVER_EVENTS,
  serverConversationEventSchema,
  serverCountersEventSchema,
  serverMessageEventSchema,
  serverNotificationEventSchema,
  serverReadEventSchema,
  serverTypingEventSchema,
} from '@pitchorium/contracts';
import type { QueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { dispatchRealtime } from './realtime-bus';
import { COUNTERS_QUERY_KEY } from '@/lib/query/keys';

/**
 * Wires a Socket.IO event to the cache and to the pages that listen (realtime-bus.ts). A pushed
 * event is only a shortcut: the HTTP routes stay the truth (docs/architecture/realtime.md),
 * hence invalidations rather than writes, except the counters which the event carries whole.
 * A notification never reloads the list under the reader: the page of the notifications shows a
 * pill instead (ADR 0148). Payloads failing their schema are ignored.
 */
export function realtimeHandlers(
  queryClient: QueryClient,
): Record<string, (payload: unknown) => void> {
  const conversations = getMessagingControllerListQueryKey();
  const relay =
    <T extends z.ZodType>(event: string, schema: T, then?: (payload: z.infer<T>) => void) =>
    (payload: unknown) => {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return;
      then?.(parsed.data);
      dispatchRealtime(event, parsed.data);
    };
  const refreshList = () => void queryClient.invalidateQueries({ queryKey: conversations });
  return {
    [SERVER_EVENTS.counters]: relay(SERVER_EVENTS.counters, serverCountersEventSchema, (data) =>
      queryClient.setQueryData(COUNTERS_QUERY_KEY, data.counters),
    ),
    [SERVER_EVENTS.notification]: relay(SERVER_EVENTS.notification, serverNotificationEventSchema),
    [SERVER_EVENTS.message]: relay(SERVER_EVENTS.message, serverMessageEventSchema, refreshList),
    [SERVER_EVENTS.messageUpdated]: relay(
      SERVER_EVENTS.messageUpdated,
      serverMessageEventSchema,
      refreshList,
    ),
    [SERVER_EVENTS.read]: relay(SERVER_EVENTS.read, serverReadEventSchema, (data) => {
      if (data.mine) refreshList();
    }),
    [SERVER_EVENTS.typing]: relay(SERVER_EVENTS.typing, serverTypingEventSchema),
    [SERVER_EVENTS.conversation]: relay(
      SERVER_EVENTS.conversation,
      serverConversationEventSchema,
      refreshList,
    ),
  };
}
