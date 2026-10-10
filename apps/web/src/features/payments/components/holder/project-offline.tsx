'use client';

import {
  getOfflineContributionsControllerOfProjectQueryKey,
  offlineContributionsControllerOfProject,
} from '@pitchorium/api-client';
import type { OfflineContribution, OfflineContributionStatus } from '@pitchorium/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Pagination,
  Skeleton,
  ToggleGroup,
} from '@/components/ui';
import { OfflineItem } from '../offline/offline-item';
import { usePaymentProblem } from '../shared/use-payment-problem';

const DeclareOfflineDialog = lazy(() => import('../offline/declare-offline-dialog'));

const FILTERS = ['declared', 'all'] as const;

/**
 * The off-platform contributions of a project for its team (§9.3, fallback): those a contributor
 * declared, to confirm or refuse, and those the team declared for a contributor, who answers;
 * declared, confirmed, validated (counted in the amount collected) or refused. An administrator
 * validates an amount on proof (FRONT 9).
 */
export function ProjectOffline({ projectId, title }: { projectId: string; title: string }) {
  const t = useTranslations('web.payments.holder.offline');
  const problem = usePaymentProblem();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('declared');
  const [declaring, setDeclaring] = useState(false);
  const [mounted, setMounted] = useState(false);
  const params: { limit: number; status?: OfflineContributionStatus } = {
    limit: 20,
    ...(filter === 'declared' ? { status: 'declared' } : {}),
  };
  const key = getOfflineContributionsControllerOfProjectQueryKey(projectId, params);
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      offlineContributionsControllerOfProject(
        projectId,
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items: OfflineContribution[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getOfflineContributionsControllerOfProjectQueryKey(projectId),
    });

  return (
    <section aria-labelledby="project-offline" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <Heading level={2} size="section" id="project-offline">
            {t('title')}
          </Heading>
          <p className="text-sm text-muted">{t('description')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setMounted(true);
            setDeclaring(true);
          }}
        >
          <Plus aria-hidden />
          {t('declare')}
        </Button>
      </div>
      <ToggleGroup
        type="single"
        label={t('filter')}
        value={filter}
        onValueChange={setFilter}
        options={FILTERS.map((value) => ({ value, label: t(`filters.${value}`) }))}
      />
      {list.isError ? (
        <ErrorState
          size="inline"
          title={t('unreadable')}
          description={problem(list.error)}
          onRetry={() => void list.refetch()}
        />
      ) : list.isPending ? (
        <Loading label={t('loading')}>
          <Skeleton className="h-32 w-full" />
        </Loading>
      ) : items.length === 0 ? (
        <EmptyState
          size="inline"
          title={t(filter === 'declared' ? 'emptyDeclared' : 'empty')}
          description={t('emptyBody')}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <OfflineItem
              key={item.id}
              item={item}
              party="team"
              canRespond={item.declaredBy === 'contributor'}
              onChanged={() => void refresh()}
            />
          ))}
          <Pagination
            hasMore={list.hasNextPage}
            loading={list.isFetchingNextPage}
            onLoadMore={() => void list.fetchNextPage()}
          />
        </div>
      )}
      {mounted ? (
        <Suspense fallback={null}>
          <DeclareOfflineDialog
            projectId={projectId}
            projectTitle={title}
            open={declaring}
            onOpenChange={setDeclaring}
            team
            onDeclared={() => void refresh()}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
