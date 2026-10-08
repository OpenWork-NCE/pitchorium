'use client';

import {
  type FeedPageDtoOutput,
  getPostsControllerReadQueryKey,
  postsControllerRead,
} from '@pitchorium/api-client';
import type { FeedItem, Suggestion } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState, Loading, Pagination } from '@/components/ui';
import { SuggestionsList } from '@/features/discovery';
import { chunk, interleave } from '@/lib/collections/interleave';
import { PostCard } from './post-card';
import { PostSkeleton } from './post-skeleton';

/** Where the modules go among the items of a narrow feed (docs/design/patterns.md). */
export const FEED_MODULES = { first: 3, every: 10, suggestions: 3 } as const;

/** Items of a page of the feed. */
const PAGE_SIZE = 20;

interface FeedStreamProps {
  /** First page, read by the server for the first render; null if the api could not answer. */
  initialPage: FeedPageDtoOutput | null;
  /** People suggested to the member, shown among the items on a narrow screen. */
  suggestions: readonly Suggestion[];
  /** Actions under a publication (react, comment, share). */
  actionsOf?: (post: Extract<FeedItem, { post: unknown }>['post']) => ReactNode;
}

/**
 * The feed (§10.3, ADR 0032): its items as the api orders them, then the next pages on demand.
 * On a narrow screen, where the side columns are not shown, the suggestions come among the items:
 * three after the third item, then three every ten items. Publications, reposts and highlights
 * show; a type the web does not draw yet (project update, event) is left out, as the contract
 * asks of an unknown type.
 */
export function FeedStream({ initialPage, suggestions, actionsOf }: FeedStreamProps) {
  const t = useTranslations('web.feed');
  const feed = useInfiniteQuery({
    queryKey: getPostsControllerReadQueryKey({ limit: PAGE_SIZE }),
    queryFn: ({ pageParam, signal }) =>
      postsControllerRead(
        { limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [null as string | null] } }
      : {}),
  });

  if (feed.isPending) {
    return (
      <Loading className="grid gap-4">
        <PostSkeleton />
        <PostSkeleton />
      </Loading>
    );
  }
  if (feed.isError && !feed.data) {
    return <ErrorState title={t('error')} onRetry={() => void feed.refetch()} />;
  }

  const items = feed.data.pages.flatMap((page) => page.items);
  const modules = chunk(
    suggestions.filter((suggestion) => suggestion.candidate.kind === 'person'),
    FEED_MODULES.suggestions,
  );
  const entries = interleave(
    items.filter(
      (item) => item.type === 'post' || item.type === 'repost' || item.type === 'featured',
    ),
    modules,
    FEED_MODULES,
  );

  return (
    <div className="grid gap-4">
      {items.length === 0 ? (
        <EmptyState icon={<Newspaper />} title={t('emptyTitle')} description={t('emptyBody')} />
      ) : null}
      {entries.map((entry, index) =>
        entry.kind === 'item' ? (
          'post' in entry.value ? (
            <PostCard
              key={entry.value.id}
              post={entry.value.post}
              actions={actionsOf?.(entry.value.post)}
            />
          ) : null
        ) : (
          <SuggestionsList
            key={`suggestions-${index}`}
            suggestions={entry.value}
            className="lg:hidden"
            headingLevel={2}
          />
        ),
      )}
      <Pagination
        hasMore={feed.hasNextPage}
        loading={feed.isFetchingNextPage}
        onLoadMore={() => void feed.fetchNextPage()}
        shown={items.length}
      />
      {feed.isFetchNextPageError ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </div>
  );
}
