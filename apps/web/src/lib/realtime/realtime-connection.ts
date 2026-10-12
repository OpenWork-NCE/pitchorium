import {
  getMessagingControllerListQueryKey,
  getNotificationsControllerListQueryKey,
} from '@pitchorium/api-client';
import type { QueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { preloadWhenIdle, whenOnline } from '@/lib/preload';
import { publicEnv } from '@/lib/public-env';
import { dispatchRealtime, LOCAL_EVENTS, setRealtimeSender } from './realtime-bus';
import { COUNTERS_QUERY_KEY } from '@/lib/query/keys';

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
/**
 * When the handlers are fetched after the connection when no event came: past the start of the
 * page. The first event fetches them at once, and the events received meanwhile wait for them in
 * their order (ADR 0168).
 */
const HANDLERS_PRELOAD_DELAY_MS = 10_000;

export function connect(queryClient: QueryClient): () => void {
  const socket = io(publicEnv.apiUrl, {
    withCredentials: true,
    transports: ['websocket'],
    ...RECONNECTION,
  });
  let handlers: Promise<Record<string, (payload: unknown) => void>> | undefined;
  const load = () => {
    // An event can arrive offline on a socket still open: its code waits for the network.
    handlers ??= whenOnline()
      .then(() => import('./realtime-handlers'))
      .then((module) => module.realtimeHandlers(queryClient));
    const loading = handlers;
    // The code of the handlers could not load (offline): the next event tries again, and what
    // a lost event said is read again at the reconnection (`local:resumed`).
    loading.catch(() => {
      if (handlers === loading) handlers = undefined;
    });
    return loading;
  };
  // Fetched while the network is there, so that an event that arrives offline finds them (they
  // carry Zod and the schemas, kept off the start of the page, ADR 0094), but once the start of
  // the page is over: evaluated at its first idle moment, Zod was a task of 125 ms on the
  // emulated phone, a third of the blocking time of the feed (ADR 0163).
  let cancelIdle: () => void = () => undefined;
  const preloadTimer = setTimeout(() => {
    cancelIdle = preloadWhenIdle(load);
  }, HANDLERS_PRELOAD_DELAY_MS);
  const cancelPreload = () => {
    clearTimeout(preloadTimer);
    cancelIdle();
  };
  // One promise for every event: they are handled in the order they arrived, the first one
  // fetching the handlers at once rather than after the delay (ADR 0168).
  socket.onAny((event: string, payload: unknown) => {
    void load()
      .then((byEvent) => byEvent[event]?.(payload))
      .catch(() => undefined);
  });

  let connectedOnce = false;
  socket.on('connect', () => {
    setRealtimeSender(socket);
    if (!connectedOnce) {
      connectedOnce = true;
      return;
    }
    for (const queryKey of [
      COUNTERS_QUERY_KEY,
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
    cancelPreload();
    clearTimeout(pause);
    document.removeEventListener('visibilitychange', visibility);
    setRealtimeSender(null);
    socket.offAny();
    socket.off('connect');
    socket.off('disconnect');
    if (socket.connected || !socket.active) {
      socket.disconnect();
      return;
    }
    // Still connecting (the shell remounts on a navigation between groups of pages): closed
    // once its attempt ends, as WebKit reports a socket closed before it is established.
    const close = () => socket.disconnect();
    socket.once('connect', close);
    socket.once('connect_error', close);
  };
}
