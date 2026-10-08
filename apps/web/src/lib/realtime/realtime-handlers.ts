import '@/lib/zod';

import {
  getMessagingControllerListQueryKey,
  getNotificationsControllerCountersQueryKey,
  getNotificationsControllerListQueryKey,
} from '@pitchorium/api-client';
import {
  SERVER_EVENTS,
  serverConversationEventSchema,
  serverCountersEventSchema,
  serverMessageEventSchema,
  serverNotificationEventSchema,
} from '@pitchorium/contracts';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Wires a Socket.IO event to the cache. A pushed event is only a shortcut: the HTTP routes stay
 * the truth (docs/architecture/realtime.md), hence invalidations rather than writes, except the
 * counters which the event carries whole. Payloads failing their schema are ignored.
 */
export function realtimeHandlers(
  queryClient: QueryClient,
): Record<string, (payload: unknown) => void> {
  const conversations = getMessagingControllerListQueryKey();
  return {
    [SERVER_EVENTS.counters]: (payload) => {
      const parsed = serverCountersEventSchema.safeParse(payload);
      if (parsed.success) {
        queryClient.setQueryData(
          getNotificationsControllerCountersQueryKey(),
          parsed.data.counters,
        );
      }
    },
    [SERVER_EVENTS.notification]: (payload) => {
      if (!serverNotificationEventSchema.safeParse(payload).success) return;
      void queryClient.invalidateQueries({ queryKey: getNotificationsControllerListQueryKey() });
    },
    [SERVER_EVENTS.message]: (payload) => {
      if (!serverMessageEventSchema.safeParse(payload).success) return;
      void queryClient.invalidateQueries({ queryKey: conversations });
    },
    [SERVER_EVENTS.messageUpdated]: (payload) => {
      if (!serverMessageEventSchema.safeParse(payload).success) return;
      void queryClient.invalidateQueries({ queryKey: conversations });
    },
    [SERVER_EVENTS.conversation]: (payload) => {
      if (!serverConversationEventSchema.safeParse(payload).success) return;
      void queryClient.invalidateQueries({ queryKey: conversations });
    },
  };
}
