'use client';

import {
  contributionsControllerMine,
  getContributionsControllerMineQueryKey,
} from '@pitchorium/api-client';
import type { Contribution, ContributionStatus } from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Loading,
  Pagination,
  RelativeTime,
  Select,
  Skeleton,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format/money';
import { statusTone } from '../../lib/status';
import { usePaymentProblem } from '../shared/use-payment-problem';

const STATUSES: readonly ContributionStatus[] = [
  'succeeded',
  'pending_payment',
  'partially_refunded',
  'refunded',
  'disputed',
  'failed',
  'expired',
  'canceled',
];

/**
 * « Mes contributions » (§9.4): every contribution of the member with its status, refunds
 * included, its amount in the currency paid and its EUR equivalent frozen by the api; each opens
 * its detail.
 */
export function MyContributions() {
  const t = useTranslations('web.payments.mine');
  const statuses = useTranslations('reference.contributionStatuses');
  const kinds = useTranslations('reference.contributionKinds');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const [status, setStatus] = useState<ContributionStatus | 'all'>('all');
  const params = { limit: 20, ...(status === 'all' ? {} : { status }) };
  const list = useInfiniteQuery({
    queryKey: getContributionsControllerMineQueryKey(params),
    queryFn: ({ pageParam, signal }) =>
      contributionsControllerMine(
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items: Contribution[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section
      aria-labelledby="my-contributions"
      className="grid gap-4"
      data-testid="my-contributions"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading level={2} size="section" id="my-contributions">
          {t('title')}
        </Heading>
        <Field label={t('filter')} className="w-full sm:w-64">
          <Select
            value={status}
            onValueChange={setStatus}
            options={[
              { value: 'all' as const, label: t('allStatuses') },
              ...STATUSES.map((value) => ({ value, label: statuses(value) })),
            ]}
          />
        </Field>
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
          <Skeleton className="h-40 w-full" />
        </Loading>
      ) : items.length === 0 ? (
        <EmptyState
          size="inline"
          title={t(status === 'all' ? 'emptyTitle' : 'emptyFiltered')}
          description={t(status === 'all' ? 'emptyBody' : 'emptyFilteredBody')}
          action={status === 'all' ? <Link href={routes.projects}>{t('browse')}</Link> : undefined}
        />
      ) : (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={routes.contribution(item.id)}
                className="grid gap-2 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{item.project.title}</span>
                  <span className="text-sm text-muted">
                    {kinds(item.kind)} · <RelativeTime date={item.createdAt} />
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <span className="font-numeric tabular-nums">
                    {formatMoney(item.amount, locale, 'financial')}
                    {item.amount.currency !== 'EUR' ? (
                      <span className="ml-1.5 text-sm text-muted">
                        {t('equivalent', {
                          amount: formatMoney(item.eurEquivalent, locale, 'financial'),
                        })}
                      </span>
                    ) : null}
                  </span>
                  <Badge tone={statusTone(item.status)}>{statuses(item.status)}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 ? (
        <Pagination
          hasMore={list.hasNextPage}
          loading={list.isFetchingNextPage}
          onLoadMore={() => void list.fetchNextPage()}
        />
      ) : null}
    </section>
  );
}
