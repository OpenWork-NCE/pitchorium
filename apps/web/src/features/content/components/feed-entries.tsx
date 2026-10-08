import type { FeedItem, Suggestion } from '@pitchorium/contracts';
import { SuggestionsList } from '@/features/discovery';
import { chunk, interleave } from '@/lib/collections/interleave';
import { PostCard } from './post-card';
import { ReactionButton } from './reaction-button';

/** Where the modules go among the items of a narrow feed (docs/design/patterns.md). */
export const FEED_MODULES = { first: 3, every: 10, suggestions: 3 } as const;

/** Items of a page of the feed. */
export const FEED_PAGE_SIZE = 20;

type Shown = Extract<FeedItem, { type: 'post' | 'repost' | 'featured' }>;

/** The items the web draws: publications, reposts and highlights (the others are left out). */
export function shownItems(items: readonly FeedItem[]): Shown[] {
  return items.filter(
    (item): item is Shown =>
      item.type === 'post' || item.type === 'repost' || item.type === 'featured',
  );
}

/** Modules of suggestions of a narrow feed: three people each. */
export function suggestionModules(suggestions: readonly Suggestion[]): Suggestion[][] {
  return chunk(
    suggestions.filter((suggestion) => suggestion.candidate.kind === 'person'),
    FEED_MODULES.suggestions,
  );
}

/**
 * Items of the feed with the modules of suggestions among them (narrow screens only): rendered by
 * the server for the first page, by the browser for the next ones.
 */
export function FeedEntries({
  items,
  modules,
  start = 0,
}: {
  items: readonly Shown[];
  modules: readonly Suggestion[][];
  /** Items shown above, from the previous pages. */
  start?: number;
}) {
  return interleave(items, modules, FEED_MODULES, start).map((entry, index) =>
    entry.kind === 'item' ? (
      <PostCard
        key={entry.value.id}
        post={entry.value.post}
        actions={<ReactionButton post={entry.value.post} />}
      />
    ) : (
      <SuggestionsList
        key={`suggestions-${start}-${index}`}
        suggestions={entry.value}
        className="lg:hidden"
        headingLevel={2}
      />
    ),
  );
}

/** How many modules a page of the feed uses, to hand the rest to the next page. */
export function modulesUsed(itemCount: number, moduleCount: number, start = 0): number {
  return interleave(
    Array.from({ length: itemCount }),
    Array.from({ length: moduleCount }),
    FEED_MODULES,
    start,
  ).filter((entry) => entry.kind === 'module').length;
}

/** A page of the feed drawn by the browser: its items, the modules left to it, where it starts. */
export interface FeedSlice {
  items: Shown[];
  modules: readonly Suggestion[][];
  start: number;
}

/**
 * Splits the modules left after the first page among the next pages, each page taking up where
 * the previous one stopped. Returns the slices and how many items they show in all.
 */
export function feedSlices(
  pages: readonly { items: readonly FeedItem[] }[],
  modules: readonly Suggestion[][],
  shown: number,
): { slices: FeedSlice[]; total: number } {
  return pages.reduce<{ slices: FeedSlice[]; total: number; rest: readonly Suggestion[][] }>(
    ({ slices, total, rest }, page) => {
      const items = shownItems(page.items);
      return {
        slices: [...slices, { items, modules: rest, start: total }],
        total: total + items.length,
        rest: rest.slice(modulesUsed(items.length, rest.length, total)),
      };
    },
    { slices: [], total: shown, rest: modules },
  );
}
