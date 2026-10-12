/** Without requestIdleCallback (Safari), the wait after the load of the page. */
const AFTER_LOAD_MS = 200;

/** A preload waiting for its idle moment, shared by the components of its module. */
interface Preload {
  users: number;
  cancelIdle: () => void;
  online?: () => void;
}

/** Preloads not yet started, by loader: one idle callback per module, never one per component. */
const scheduled = new Map<() => Promise<unknown>, Preload>();
/** Loaders already started (removed again on a failure, retried at first use). */
const started = new WeakSet<() => Promise<unknown>>();

/**
 * Loads a module once the page is idle: code kept out of the first load (ADR 0094) is then
 * already in memory when it is needed, offline included (ADR 0097). Safari has no idle callback:
 * shortly after the load of the page instead. Offline at that moment, the load waits for the
 * network rather than fail. A failed preload is retried at first use.
 *
 * Each instance of a component asks for its module (a list of fifty messages, each with its
 * buttons): the first request schedules the preload, the next ones share it, and only the last
 * one to leave cancels it. One idle callback per instance (some 250 on a long conversation) kept
 * WebKit running them four per frame for half a second after the load, the timers of the page
 * waiting behind them (the draft of a message written late, PROMPT FRONT 9C).
 */
export function preloadWhenIdle(load: () => Promise<unknown>): () => void {
  if (started.has(load)) return () => undefined;
  let preload = scheduled.get(load);
  if (!preload) {
    const entry: Preload = { users: 0, cancelIdle: () => undefined };
    const run = () => {
      scheduled.delete(load);
      started.add(load);
      void load().catch(() => {
        started.delete(load);
      });
    };
    entry.cancelIdle = whenIdle(() => {
      if (navigator.onLine) return run();
      entry.online = run;
      window.addEventListener('online', run, { once: true });
    });
    scheduled.set(load, entry);
    preload = entry;
  }
  const own = preload;
  own.users += 1;
  let released = false;
  return () => {
    if (released || scheduled.get(load) !== own) return;
    released = true;
    own.users -= 1;
    if (own.users > 0) return;
    scheduled.delete(load);
    own.cancelIdle();
    if (own.online) window.removeEventListener('online', own.online);
  };
}

/**
 * Runs a task once the page is idle (after the load in Safari): work that does not change the
 * first view (a cookie, the realtime channel, the features of the animations) never lengthens
 * the start of the page (Total Blocking Time, ADR 0094).
 */
export function whenIdle(run: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const page: Window = window;
  if ('requestIdleCallback' in window) {
    const handle = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  let handle: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    handle = setTimeout(run, AFTER_LOAD_MS);
  };
  if (document.readyState === 'complete') schedule();
  else page.addEventListener('load', schedule, { once: true });
  return () => {
    page.removeEventListener('load', schedule);
    clearTimeout(handle);
  };
}

/**
 * Resolves at once with the network, else at its return: code is never fetched offline, where
 * the request fails and the browser reports it.
 */
export function whenOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('online', () => resolve(), { once: true });
  });
}

/** A promise of the next idle moment of the page. */
export function idle(): Promise<void> {
  return new Promise((resolve) => {
    whenIdle(resolve);
  });
}
