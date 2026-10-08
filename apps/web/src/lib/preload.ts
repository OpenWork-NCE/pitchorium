/** Without requestIdleCallback (Safari), the wait after the load of the page. */
const AFTER_LOAD_MS = 200;

/**
 * Loads a module once the page is idle: code kept out of the first load (ADR 0094) is then
 * already in memory when it is needed, offline included (ADR 0097). Safari has no idle callback:
 * shortly after the load of the page instead. A failed preload is retried at first use.
 */
export function preloadWhenIdle(load: () => Promise<unknown>): () => void {
  return whenIdle(() => void load().catch(() => undefined));
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

/** A promise of the next idle moment of the page. */
export function idle(): Promise<void> {
  return new Promise((resolve) => {
    whenIdle(resolve);
  });
}
