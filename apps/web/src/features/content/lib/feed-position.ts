/**
 * Where the reader was in the feed, kept for the tab (sessionStorage) and given back when they
 * come back to it by the history (ADR 0121): the offset of the page and the measured heights of
 * the items, so that the virtualized list has its full height before the scroll is restored.
 */
export interface FeedPosition {
  offset: number;
  measurements: {
    index: number;
    key: string | number | bigint;
    start: number;
    size: number;
    end: number;
    lane: number;
  }[];
  savedAt: number;
}

const KEY = 'pitchorium:feed-position';
/** A position older than this is not given back (the feed has moved on). */
const MAX_AGE_MS = 30 * 60_000;

let cameBack = false;
if (typeof window !== 'undefined') {
  // A return by the history (back, forward): the next feed mounted restores its position.
  window.addEventListener('popstate', () => {
    cameBack = true;
  });
}

export function saveFeedPosition(position: Omit<FeedPosition, 'savedAt'>): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...position, savedAt: Date.now() }));
  } catch {
    // Storage refused (private mode): the position is simply not kept.
  }
}

/** The position to give back, once, when the reader came back by the history. */
export function takeFeedPosition(now = Date.now()): FeedPosition | null {
  const back = cameBack;
  cameBack = false;
  if (!back) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const position = JSON.parse(raw) as FeedPosition;
    return now - position.savedAt < MAX_AGE_MS ? position : null;
  } catch {
    return null;
  }
}
