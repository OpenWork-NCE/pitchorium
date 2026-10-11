'use client';

import {
  contributionsControllerSupporters,
  getContributionsControllerSupportersQueryKey,
} from '@pitchorium/api-client';
import type { Supporter } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  Avatar,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Pagination,
  RelativeTime,
  Skeleton,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { usePlural } from '@/lib/i18n/plural';
import { usePaymentProblem } from '../shared/use-payment-problem';

/**
 * The public supporters of a project, as its page shows them (§11.2): the members and the
 * organisations who chose to appear, without any amount, and the counts of the paid
 * contributions and of the love money commitments, apart.
 */
export function ProjectSupporters({ projectId }: { projectId: string }) {
  const t = useTranslations('web.payments.holder.supporters');
  const kinds = useTranslations('reference.contributionKinds');
  const locale = useLocale();
  const plural = usePlural();
  const problem = usePaymentProblem();
  const params = { limit: 20 };
  const list = useInfiniteQuery({
    queryKey: getContributionsControllerSupportersQueryKey(projectId, params),
    queryFn: ({ pageParam, signal }) =>
      contributionsControllerSupporters(
        projectId,
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const first = list.data?.pages[0];
  const supporters: Supporter[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <section aria-labelledby="project-supporters" className="grid gap-5">
      <div className="grid gap-1">
        <Heading level={2} size="section" id="project-supporters">
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
      ) : list.isPending || !first ? (
        <Loading label={t('loading')}>
          <Skeleton className="h-24 w-full" />
        </Loading>
      ) : (
        <>
          <p className="text-sm tabular-nums">
            {t(`contributions.${plural(first.contributionCount)}`, {
              count: count(first.contributionCount),
            })}
            <span aria-hidden> · </span>
            {t(`commitments.${plural(first.commitmentCount)}`, {
              count: count(first.commitmentCount),
            })}
          </p>
          {supporters.length === 0 ? (
            <EmptyState size="inline" title={t('emptyTitle')} description={t('emptyBody')} />
          ) : (
            <ul className="grid gap-3">
              {supporters.map((supporter) => (
                <li
                  key={`${supporter.type}:${supporter.key}:${supporter.supportedAt}`}
                  className="flex items-center gap-3"
                >
                  <Avatar
                    name={supporter.displayName}
                    src={supporter.avatarUrl}
                    size="sm"
                    shape={supporter.type === 'organization' ? 'square' : 'circle'}
                    decorative
                  />
                  <span className="grid min-w-0">
                    <Link
                      href={
                        supporter.type === 'organization'
                          ? routes.organization(supporter.key)
                          : routes.member(supporter.key)
                      }
                      className="truncate font-medium"
                    >
                      {supporter.displayName}
                    </Link>
                    <span className="text-sm text-muted">
                      {kinds(supporter.kind)} · <RelativeTime date={supporter.supportedAt} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            hasMore={list.hasNextPage}
            loading={list.isFetchingNextPage}
            onLoadMore={() => void list.fetchNextPage()}
          />
        </>
      )}
    </section>
  );
}
