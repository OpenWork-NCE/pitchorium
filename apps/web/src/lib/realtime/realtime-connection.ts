import { getNotificationsControllerCountersQueryKey } from '@pitchorium/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { publicEnv } from '@/lib/public-env';

/**
 * Socket.IO connection of a signed-in member (namespace `/`, session cookie, trusted origin).
 * After a reconnection the counters are read again over HTTP. Loaded after the first render by
 * RealtimeProvider; the handlers, with Zod and the schemas of the payloads, load with the first
 * event (realtime-handlers.ts): neither weighs on the loading of the page (ADR 0094).
 */
export function connect(queryClient: QueryClient): () => void {
  const socket = io(publicEnv.apiUrl, {
    withCredentials: true,
    transports: ['websocket'],
  });
  let handlers: Promise<Record<string, (payload: unknown) => void>> | undefined;
  // One promise for every event: they are handled in the order they arrived.
  socket.onAny((event: string, payload: unknown) => {
    handlers ??= import('./realtime-handlers').then((module) =>
      module.realtimeHandlers(queryClient),
    );
    void handlers.then((byEvent) => byEvent[event]?.(payload));
  });
  socket.io.on('reconnect', () => {
    void queryClient.invalidateQueries({
      queryKey: getNotificationsControllerCountersQueryKey(),
    });
  });
  return () => {
    socket.disconnect();
  };
}
