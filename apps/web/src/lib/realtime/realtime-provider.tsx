'use client';

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
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { io } from 'socket.io-client';
import { publicEnv } from '@/lib/public-env';

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

/**
 * Socket.IO connection of a signed-in member (namespace `/`, session cookie, trusted origin),
 * mounted by the member space only. After a reconnection the counters are read again over HTTP.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(publicEnv.apiUrl, {
      withCredentials: true,
      transports: ['websocket'],
    });
    for (const [event, handler] of Object.entries(realtimeHandlers(queryClient))) {
      socket.on(event, handler);
    }
    socket.io.on('reconnect', () => {
      void queryClient.invalidateQueries({
        queryKey: getNotificationsControllerCountersQueryKey(),
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  return children;
}
