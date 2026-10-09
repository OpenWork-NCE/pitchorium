/**
 * The views a page still holds (ADR 0116), sent before a sign-out: once the session is gone,
 * the api would refuse them (401) and they would be lost.
 */
interface PendingViews {
  /** Sends what waits and resolves when the api has answered. */
  send: () => Promise<void>;
  /** Forgets what is left: nothing more leaves after the sign-out. */
  stop: () => void;
}

const pages = new Set<PendingViews>();

/** Registers the views of a page; returns its removal. */
export function registerPendingViews(views: PendingViews): () => void {
  pages.add(views);
  return () => pages.delete(views);
}

/** Before a sign-out: every page sends its views, then sends no more. */
export async function sendPendingViews(): Promise<void> {
  await Promise.all([...pages].map((views) => views.send()));
  for (const views of pages) views.stop();
}
