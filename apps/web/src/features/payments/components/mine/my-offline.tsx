'use client';

import {
  getOfflineContributionsControllerMineQueryKey,
  offlineContributionsControllerMine,
} from '@pitchorium/api-client';
import type { OfflineContribution } from '@pitchorium/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState, Heading, Loading, Pagination, Skeleton } from '@/components/ui';
import { OfflineItem } from '../offline/offline-item';
import { usePaymentProblem } from '../shared/use-payment-problem';

/**
 * The off-platform contributions of the member (§9.3): those they declared, waiting for the team,
 * and those a team declared for them, to confirm or refuse; each with its state.
 */
export function MyOffline() {
  const t = useTranslations('web.payments.mine.offline');
  const problem = usePaymentProblem();
  const queryClient = useQueryClient();
  const params = { limit: 20 };
  const list = useInfiniteQuery({
    queryKey: getOfflineContributionsControllerMineQueryKey(params),
    queryFn: ({ pageParam, signal }) =>
      offlineContributionsControllerMine(
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items: OfflineContribution[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section aria-labelledby="my-offline" className="grid gap-4" data-testid="my-offline">
      <div className="grid gap-1">
        <Heading level={2} size="section" id="my-offline">
          {t('title')}
        </Heading>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>
      {list.isError ? (
        <ErrorState
          size="inline"
          title={t('unreadable')}
          description={problem(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : list.isPending ? (
        <Loading label={t('loading')}>
          <Skeleton className="h-24 w-full" />
        </Loading>
      ) : items.length === 0 ? (
        <EmptyState size="inline" title={t('emptyTitle')} description={t('emptyBody')} />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <OfflineItem
              key={item.id}
              item={item}
              party="contributor"
              canRespond={item.declaredBy === 'holder'}
              onChanged={() =>
                void queryClient.invalidateQueries({
                  queryKey: getOfflineContributionsControllerMineQueryKey(),
                })
              }
            />
          ))}
          <Pagination
            hasMore={list.hasNextPage}
            loading={list.isFetchingNextPage}
            onLoadMore={() => void list.fetchNextPage()}
          />
        </div>
      )}
    </section>
  );
}
