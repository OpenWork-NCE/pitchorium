import { LIMITS } from './limits';

/**
 * Publications seen on screen, signalled to the api in groups (ADR 0116): a publication counts
 * once per page, the signals leave at most every FLUSH_DELAY_MS and when the page is left.
 */

/** Publications per signal, as the api accepts them. */
export const VIEWS_PER_SIGNAL = LIMITS.viewsPerSignal;

/** A publication is seen when half of it at least stays on screen this long. */
export const SEEN_AFTER_MS = 1000;
export const SEEN_RATIO = 0.5;
/** Delay before a group leaves: the publications seen meanwhile go with it. */
export const FLUSH_DELAY_MS = 5000;

export interface ViewSignal {
  /** A publication was seen; ignored when it already was in this page. */
  seen(postId: string): void;
  /** Sends what is waiting now (the page is being left). */
  flush(): void;
  /** Stops the timer (the feed leaves the page). */
  dispose(): void;
}

/**
 * The batching of the signals: `send` receives at most VIEWS_PER_SIGNAL publications at a time; a failed send is not retried (a view is not worth a second request).
 */
export function createViewSignal(
  send: (postIds: string[]) => void,
  schedule: (run: () => void, delay: number) => () => void = (run, delay) => {
    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  },
): ViewSignal {
  const sent = new Set<string>();
  let waiting: string[] = [];
  let cancel: (() => void) | null = null;
  let disposed = false;
  const flush = () => {
    cancel?.();
    cancel = null;
    while (waiting.length > 0) send(waiting.splice(0, VIEWS_PER_SIGNAL));
  };
  return {
    seen(postId) {
      // Disposed (the page left, the member signed out): nothing more is signalled.
      if (disposed || sent.has(postId)) return;
      sent.add(postId);
      waiting.push(postId);
      cancel ??= schedule(flush, FLUSH_DELAY_MS);
    },
    flush,
    dispose() {
      disposed = true;
      cancel?.();
      cancel = null;
      waiting = [];
    },
  };
}
