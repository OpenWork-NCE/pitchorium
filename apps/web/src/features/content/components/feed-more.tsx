'use client';

import { getPostsControllerReadQueryKey, postsControllerRead } from '@pitchorium/api-client';
import type { FeedPage, Suggestion } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ErrorState, Loading, Pagination } from '@/components/ui';
import { FEED_PAGE_SIZE, FeedEntries, feedSlices } from './feed-entries';
import { PostSkeleton } from './post-skeleton';

interface FeedMoreProps {
  /** Cursor after the page shown by the server; null at the end (or without a first page). */
  cursor: string | null;
  /** Items the server showed. */
  shown: number;
  /** Modules of suggestions left for the next pages. */
  modules: readonly Suggestion[][];
  /** The server could not read the first page: read it here. */
  first?: boolean;
}

/**
 * The next pages of the feed, on demand (« Afficher plus »), with the modules of suggestions
 * going on where the first page left them; the first page too when the server could not read it.
 * The rest of the feed is rendered by the server, without code to hydrate (ADR 0094).
 */
export function FeedMore({ cursor, shown, modules, first = false }: FeedMoreProps) {
  const t = useTranslations('web.feed');
  const [started, setStarted] = useState(first);
  const feed = useInfiniteQuery({
    queryKey: [...getPostsControllerReadQueryKey({ limit: FEED_PAGE_SIZE }), 'after', cursor],
    queryFn: ({ pageParam, signal }) =>
      postsControllerRead(
        { limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<FeedPage>,
    initialPageParam: cursor,
    getNextPageParam: (page) => page.nextCursor,
    enabled: started,
  });

  if (!started) {
    return (
      <Pagination hasMore={cursor !== null} onLoadMore={() => setStarted(true)} shown={shown} />
    );
  }
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

  const { slices, total } = feedSlices(feed.data.pages, modules, shown);
  return (
    <>
      {slices.map((slice, index) => (
        <FeedEntries key={index} {...slice} />
      ))}
      <Pagination
        hasMore={feed.hasNextPage}
        loading={feed.isFetchingNextPage}
        onLoadMore={() => void feed.fetchNextPage()}
        shown={total}
      />
      {feed.isFetchNextPageError ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </>
  );
}
