'use client';

import {
  contributionsControllerExport,
  contributionsControllerOfProject,
  getContributionsControllerOfProjectQueryKey,
} from '@pitchorium/api-client';
import type {
  ContributionKind,
  ContributionStatus,
  ProjectContribution,
} from '@pitchorium/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  RelativeTime,
  Select,
  Table,
  type TableColumn,
} from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { statusTone } from '../../lib/status';
import { downloadCsv } from '@/lib/files/download-csv';
import { usePaymentProblem } from '../shared/use-payment-problem';

const STATUSES: readonly ContributionStatus[] = [
  'succeeded',
  'pending_payment',
  'partially_refunded',
  'refunded',
  'disputed',
  'dispute_won',
  'dispute_lost',
  'failed',
  'expired',
  'canceled',
];
const KINDS: readonly ContributionKind[] = ['donation', 'reward_crowdfunding', 'love_money'];
const PAGE = 20;

/**
 * The contributions of a project for its team (§11.3): a table paginated by cursor in tabular
 * figures (ADR 0110), filtered by status and by kind in the api, with the amount, the commission,
 * the fees of the provider once known and the state of the reward; the export as CSV.
 */
export function ProjectContributions({ projectId, slug }: { projectId: string; slug: string }) {
  const t = useTranslations('web.payments.holder.contributions');
  const statuses = useTranslations('reference.contributionStatuses');
  const kinds = useTranslations('reference.contributionKinds');
  const states = useTranslations('web.payments.rewardStates');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const [status, setStatus] = useState<ContributionStatus | 'all'>('all');
  const [kind, setKind] = useState<ContributionKind | 'all'>('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const params = {
    limit: PAGE,
    ...(status === 'all' ? {} : { status }),
    ...(kind === 'all' ? {} : { kind }),
  };
  const list = useInfiniteQuery({
    queryKey: getContributionsControllerOfProjectQueryKey(projectId, params),
    queryFn: ({ pageParam, signal }) =>
      contributionsControllerOfProject(
        projectId,
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const rows: ProjectContribution[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  const money = (amount: ProjectContribution['amount'] | null) =>
    amount ? formatMoney(amount, locale, 'financial') : t('none');

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      downloadCsv(await contributionsControllerExport(projectId), `contributions-${slug}.csv`);
    } catch (error) {
      setExportError(problem(error));
    } finally {
      setExporting(false);
    }
  }

  const columns: TableColumn<ProjectContribution>[] = [
    {
      key: 'contributor',
      header: t('columns.contributor'),
      rowHeader: true,
      cell: (row) =>
        row.organization ? (
          <span className="grid">
            <span className="font-medium">{row.organization.title}</span>
            <span className="text-xs text-muted">{t('byOrganization')}</span>
          </span>
        ) : row.contributor ? (
          <span className="font-medium">{row.contributor.displayName}</span>
        ) : (
          <span className="text-muted">{t(row.anonymous ? 'anonymous' : 'deleted')}</span>
        ),
    },
    {
      key: 'date',
      header: t('columns.date'),
      cell: (row) => <RelativeTime date={row.createdAt} />,
    },
    { key: 'kind', header: t('columns.kind'), cell: (row) => kinds(row.kind) },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => <Badge tone={statusTone(row.status)}>{statuses(row.status)}</Badge>,
    },
    { key: 'amount', header: t('columns.amount'), align: 'end', cell: (row) => money(row.amount) },
    {
      key: 'commission',
      header: t('columns.commission'),
      align: 'end',
      cell: (row) => money(row.commission),
    },
    { key: 'fee', header: t('columns.fee'), align: 'end', cell: (row) => money(row.providerFee) },
    {
      key: 'refunded',
      header: t('columns.refunded'),
      align: 'end',
      cell: (row) => (row.refunded.amountMinor === '0' ? t('none') : money(row.refunded)),
    },
    {
      key: 'reward',
      header: t('columns.reward'),
      cell: (row) => (row.rewardId ? states(row.rewardState) : t('none')),
    },
  ];

  return (
    <section aria-labelledby="project-contributions" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <Heading level={2} size="section" id="project-contributions">
            {t('title')}
          </Heading>
          <p className="text-sm text-muted">{t('description')}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          loading={exporting}
          loadingLabel={t('exporting')}
          onClick={() => void exportCsv()}
        >
          <Download aria-hidden />
          {t('export')}
        </Button>
      </div>
      {exportError ? (
        <p role="alert" className="text-sm text-danger">
          {exportError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
        <Field label={t('filters.status')}>
          <Select
            value={status}
            onValueChange={setStatus}
            options={[
              { value: 'all' as const, label: t('filters.allStatuses') },
              ...STATUSES.map((value) => ({ value, label: statuses(value) })),
            ]}
          />
        </Field>
        <Field label={t('filters.kind')}>
          <Select
            value={kind}
            onValueChange={setKind}
            options={[
              { value: 'all' as const, label: t('filters.allKinds') },
              ...KINDS.map((value) => ({ value, label: kinds(value) })),
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
      ) : (
        <Table
          caption={t('caption')}
          hideCaption
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={list.isPending}
          empty={
            <EmptyState
              size="inline"
              title={t(status === 'all' && kind === 'all' ? 'emptyTitle' : 'emptyFiltered')}
              description={t(
                status === 'all' && kind === 'all' ? 'emptyBody' : 'emptyFilteredBody',
              )}
            />
          }
          hasMore={list.hasNextPage}
          onLoadMore={() => void list.fetchNextPage()}
          loadingMore={list.isFetchingNextPage}
        />
      )}
    </section>
  );
}
