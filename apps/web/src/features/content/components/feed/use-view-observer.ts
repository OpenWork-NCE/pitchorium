'use client';

import { postsControllerViews } from '@pitchorium/api-client';
import { useCallback, useEffect, useRef } from 'react';
import { registerPendingViews } from '@/lib/views/pending-views';
import {
  createViewSignal,
  SEEN_AFTER_MS,
  SEEN_RATIO,
  type ViewSignal,
} from '../../lib/view-signal';

interface Watcher {
  signal: ViewSignal;
  observer: IntersectionObserver;
  timers: Map<Element, ReturnType<typeof setTimeout>>;
  ids: WeakMap<Element, string>;
  /** Signals sent and not answered yet (a sign-out waits for them). */
  inflight: Set<Promise<unknown>>;
}

function createWatcher(): Watcher {
  const inflight = new Set<Promise<unknown>>();
  const signal = createViewSignal((postIds) => {
    const sending = postsControllerViews({ postIds }, { keepalive: true }).catch(() => undefined);
    inflight.add(sending);
    void sending.finally(() => inflight.delete(sending));
  });
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const ids = new WeakMap<Element, string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = ids.get(entry.target);
        if (!id) continue;
        if (entry.intersectionRatio >= SEEN_RATIO) {
          if (timers.has(entry.target)) continue;
          timers.set(
            entry.target,
            setTimeout(() => {
              timers.delete(entry.target);
              signal.seen(id);
            }, SEEN_AFTER_MS),
          );
        } else {
          clearTimeout(timers.get(entry.target));
          timers.delete(entry.target);
        }
      }
    },
    { threshold: [0, SEEN_RATIO, 1] },
  );
  return { signal, observer, timers, ids, inflight };
}

/**
 * Watches the publications of a list (ADR 0116): one seen at half for a second is signalled to
 * the api, in groups; what waits leaves when the page is hidden or left (`keepalive`). Returns
 * the ref to put on each publication with its id (null for one of the reader).
 */
export function useViewObserver(): (
  postId: string | null,
) => (element: Element | null) => (() => void) | undefined {
  const watcher = useRef<Watcher | null>(null);
  // The publications watched, observed again by a new watcher (Strict Mode mounts twice).
  const watched = useRef(new Map<Element, string>());
  const ensure = () => (watcher.current ??= createWatcher());

  useEffect(() => {
    const current = ensure();
    for (const [element, id] of watched.current) {
      current.ids.set(element, id);
      current.observer.observe(element);
    }
    const leave = () => {
      if (document.visibilityState === 'hidden') current.signal.flush();
    };
    const flush = () => current.signal.flush();
    const unregister = registerPendingViews({
      send: async () => {
        current.signal.flush();
        await Promise.all(current.inflight);
      },
      stop: () => current.signal.dispose(),
    });
    document.addEventListener('visibilitychange', leave);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', leave);
      window.removeEventListener('pagehide', flush);
      current.observer.disconnect();
      current.timers.forEach((timer) => clearTimeout(timer));
      unregister();
      current.signal.flush();
      current.signal.dispose();
      watcher.current = null;
    };
  }, []);

  return useCallback(
    (postId: string | null) => (element: Element | null) => {
      if (!element || !postId) return undefined;
      watched.current.set(element, postId);
      const current = ensure();
      current.ids.set(element, postId);
      current.observer.observe(element);
      // Out of the list (virtualized, hidden): no longer watched.
      return () => {
        watched.current.delete(element);
        watcher.current?.observer.unobserve(element);
        clearTimeout(watcher.current?.timers.get(element));
        watcher.current?.timers.delete(element);
      };
    },
    [],
  );
}
