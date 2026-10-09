import type { FeedItem } from '@pitchorium/contracts';

/** Where the modules of suggestions go among the items of a narrow feed (patterns.md). */
export const FEED_MODULES = { first: 3, every: 10, suggestions: 3 } as const;
export const FEED_PAGE_SIZE = 20;

/** Item types the web draws (ADR 0032): `event` waits for the events (PROMPT FRONT 7). */
const DRAWN = new Set(['post', 'repost', 'featured', 'suggestion', 'project_update']);
/** Known types the web leaves out for now, without reporting them. */
const LATER = new Set(['event']);

export type DrawnItem = Extract<
  FeedItem,
  { type: 'post' | 'repost' | 'featured' | 'suggestion' | 'project_update' }
>;

/**
 * The items of a page the web draws, in their order. An unknown type is left out without any
 * error on screen, as the contract asks, and reported once (`report`, Sentry when configured):
 * the api added a type the web does not know yet.
 */
export function drawnItems(
  items: readonly { type: string; id: string }[],
  report: (type: string) => void = () => undefined,
): DrawnItem[] {
  const drawn: DrawnItem[] = [];
  for (const item of items) {
    if (DRAWN.has(item.type)) drawn.push(item as DrawnItem);
    else if (!LATER.has(item.type)) report(item.type);
  }
  return drawn;
}

/** The items of `next` absent from `known` (new publications above the first one shown). */
export function newItems<T extends { id: string }>(next: readonly T[], known: readonly T[]): T[] {
  const ids = new Set(known.map((item) => item.id));
  const fresh: T[] = [];
  for (const item of next) {
    if (ids.has(item.id)) break;
    fresh.push(item);
  }
  return fresh;
}
