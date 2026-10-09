'use client';

import { postsControllerSaved } from '@pitchorium/api-client';
import type { SavedPost } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState, ErrorState, Loading, Pagination } from '@/components/ui';
import { PostSkeleton } from '../post-skeleton';
import { MemberPost } from './member-post';

type Page = { items: SavedPost[]; nextCursor: string | null };

/**
 * The publications the member saved (§10.3), the latest saved first, page by page, each with its
 * actions; one taken out of the saved ones, hidden or deleted leaves the list.
 */
export function SavedPosts({ initial }: { initial: Page | null }) {
  const t = useTranslations('web.saved');
  const format = useFormatter();
  // The instant the dates are read from, refreshed every minute (without it, next-intl falls
  // back to the clock of each side and the server and the browser write different texts).
  const now = useNow({ updateInterval: 60_000 });
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const saved = useInfiniteQuery({
    queryKey: ['content', 'saved'],
    queryFn: ({ pageParam, signal }) =>
      postsControllerSaved(
        { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<Page>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(initial ? { initialData: { pages: [initial], pageParams: [undefined] } } : {}),
  });
  if (saved.isPending) {
    return (
      <Loading className="grid gap-4">
        <PostSkeleton />
      </Loading>
    );
  }
  if (saved.isError) return <ErrorState onRetry={() => void saved.refetch()} />;
  const items = saved.data.pages
    .flatMap((page) => page.items)
    .filter((item) => !removed.has(item.post.id));
  if (items.length === 0) {
    return <EmptyState icon={<Bookmark />} title={t('emptyTitle')} description={t('emptyBody')} />;
  }
  const remove = (id: string, reason: 'hidden' | 'deleted' | null) =>
    setRemoved((current) => {
      const next = new Set(current);
      if (reason) next.add(id);
      else next.delete(id);
      return next;
    });
  return (
    <div className="grid gap-4">
      <ul className="grid gap-4">
        {items.map((item) => (
          <li key={item.post.id} className="grid gap-1">
            {/* The server and the browser read the clock seconds apart (as RelativeTime). */}
            <p className="text-xs text-muted" suppressHydrationWarning>
              {t('savedAt', { date: format.relativeTime(new Date(item.savedAt), now) })}
            </p>
            <MemberPost post={item.post} onRemove={(reason) => remove(item.post.id, reason)} />
          </li>
        ))}
      </ul>
      <Pagination
        hasMore={saved.hasNextPage}
        loading={saved.isFetchingNextPage}
        onLoadMore={() => void saved.fetchNextPage()}
        shown={items.length}
      />
    </div>
  );
}
