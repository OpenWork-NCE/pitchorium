/**
 * Loads a module once the page is idle: code kept out of the first load (ADR 0094) is then
 * already in memory when it is needed, offline included (ADR 0097). A failed preload is retried
 * at first use.
 */
export function preloadWhenIdle(load: () => Promise<unknown>): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const run = () => void load().catch(() => undefined);
  if ('requestIdleCallback' in window) {
    const handle = requestIdleCallback(run, { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 1500);
  return () => clearTimeout(handle);
}
