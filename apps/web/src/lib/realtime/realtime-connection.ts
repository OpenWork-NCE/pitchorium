import {
  getMessagingControllerListQueryKey,
  getNotificationsControllerCountersQueryKey,
  getNotificationsControllerListQueryKey,
} from '@pitchorium/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { publicEnv } from '@/lib/public-env';
import { dispatchRealtime, LOCAL_EVENTS, setRealtimeSender } from './realtime-bus';

/** A hidden tab keeps its channel this long, then closes it until it shows again. */
export const HIDDEN_PAUSE_MS = 60_000;

/**
 * Waits between two attempts after a cut: 1 s, doubled each time up to 30 s, with a random
 * share so that every tab of a cut network does not come back at the same instant.
 */
export const RECONNECTION = {
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 30_000,
  randomizationFactor: 0.5,
} as const;

/**
 * Socket.IO connection of a signed-in member (namespace `/`, session cookie, trusted origin).
 * Loaded after the first render by RealtimeProvider; the handlers, with Zod and the schemas of
 * the payloads, load with the first event (realtime-handlers.ts): neither weighs on the loading
 * of the page (ADR 0094). A cut connection comes back with a growing wait; a tab hidden for a
 * minute closes its channel and opens it again when it shows. After every return, what may have
 * been missed is read again: the counters, the lists, and the open conversation by its sequence
 * (`local:resumed`).
 */
export function connect(queryClient: QueryClient): () => void {
  const socket = io(publicEnv.apiUrl, {
    withCredentials: true,
    transports: ['websocket'],
    ...RECONNECTION,
  });
  let handlers: Promise<Record<string, (payload: unknown) => void>> | undefined;
  // One promise for every event: they are handled in the order they arrived.
  socket.onAny((event: string, payload: unknown) => {
    handlers ??= import('./realtime-handlers').then((module) =>
      module.realtimeHandlers(queryClient),
    );
    const loading = handlers;
    void loading
      .then((byEvent) => byEvent[event]?.(payload))
      .catch(() => {
        // The code of the handlers could not load (offline): the next event tries again, and
        // what this one said is read again at the reconnection (`local:resumed`).
        if (handlers === loading) handlers = undefined;
      });
  });

  let connectedOnce = false;
  socket.on('connect', () => {
    setRealtimeSender(socket);
    if (!connectedOnce) {
      connectedOnce = true;
      return;
    }
    for (const queryKey of [
      getNotificationsControllerCountersQueryKey(),
      getMessagingControllerListQueryKey(),
      getNotificationsControllerListQueryKey(),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
    dispatchRealtime(LOCAL_EVENTS.resumed, null);
  });
  socket.on('disconnect', () => setRealtimeSender(null));

  let pause: ReturnType<typeof setTimeout> | undefined;
  let paused = false;
  const visibility = () => {
    if (document.visibilityState === 'hidden') {
      pause = setTimeout(() => {
        paused = true;
        socket.disconnect();
      }, HIDDEN_PAUSE_MS);
      return;
    }
    clearTimeout(pause);
    if (paused) {
      paused = false;
      socket.connect();
    }
  };
  document.addEventListener('visibilitychange', visibility);

  return () => {
    clearTimeout(pause);
    document.removeEventListener('visibilitychange', visibility);
    setRealtimeSender(null);
    socket.disconnect();
  };
}
