'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState, Loading, Pagination, Skeleton } from '@/components/ui';
import { NETWORK_QUERY_ROOT, useProblemMessage } from './use-relationship';

interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

/**
 * A list of the api read page by page (`?cursor=`), under the key root of the network so that
 * a change of a relationship reads it again. `remove` takes an item out at once and puts it back
 * if the call that goes with it fails.
 */
export function useCursorList<T>(
  key: readonly unknown[],
  fetchPage: (params: { cursor?: string; limit: number }) => Promise<Page<T>>,
  options: { enabled?: boolean; initial?: Page<T> } = {},
) {
  const queryClient = useQueryClient();
  const queryKey = [...NETWORK_QUERY_ROOT, ...key];
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchPage({ limit: PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
    ...(options.initial
      ? { initialData: { pages: [options.initial], pageParams: [undefined] } }
      : {}),
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  async function remove(matches: (item: T) => boolean, call: () => Promise<unknown>) {
    const previous = queryClient.getQueryData<InfiniteData<Page<T>>>(queryKey);
    queryClient.setQueryData<InfiniteData<Page<T>>>(queryKey, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => !matches(item)),
            })),
          }
        : data,
    );
    try {
      await call();
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      throw error;
    }
  }

  return { query, items, remove };
}

/**
 * The rendering of such a list: rows while the first page loads (same height as a row), the
 * failure with its retry, the empty state, then the rows and « Afficher plus ».
 */
export function CursorList<T>({
  list,
  label,
  empty,
  renderItem,
}: {
  list: ReturnType<typeof useCursorList<T>>;
  /** Accessible name of the list. */
  label: string;
  empty: { title: string; description?: string; action?: ReactNode };
  renderItem: (item: T) => ReactNode;
}) {
  const message = useProblemMessage();
  const { query, items } = list;
  if (query.isPending) {
    return (
      <Loading>
        <ul className="grid gap-3">
          {[0, 1, 2].map((index) => (
            <li key={index} className="flex items-center gap-3">
              <Skeleton className="size-14 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </li>
          ))}
        </ul>
      </Loading>
    );
  }
  if (query.isError) {
    const { error } = query;
    return (
      <ErrorState
        size="inline"
        description={message(error)}
        reference={error instanceof ApiProblemError ? error.requestId : null}
        retrying={query.isRefetching}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        size="inline"
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }
  return (
    <div className="grid gap-4">
      <ul className="grid gap-1" aria-label={label}>
        {items.map((item) => renderItem(item))}
      </ul>
      <Pagination
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        shown={items.length}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </div>
  );
}
