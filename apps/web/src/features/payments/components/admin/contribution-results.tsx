'use client';

import { adminPaymentsControllerSearch } from '@pitchorium/api-client';
import type {
  AdminContributionSearchQuery,
  CursorPage,
  ProjectContribution,
} from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState, Money, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleProblem } from '@/features/admin';
import { Link } from '@/i18n/navigation';

/** Contributions found by the console (identifier, contributor or payment reference), newest first. */
export function ContributionResults({
  page,
  query,
}: {
  page: CursorPage<ProjectContribution>;
  query: Omit<AdminContributionSearchQuery, 'cursor' | 'limit'>;
}) {
  const t = useTranslations('web.admin.payments.contributions');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columns: TableColumn<ProjectContribution>[] = [
    {
      key: 'date',
      header: t('columns.date'),
      rowHeader: true,
      cell: (row) => (
        <Link
          href={routes.adminContribution(row.id)}
          className="link-underline-hover font-numeric text-accent tabular-nums"
        >
          {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </Link>
      ),
    },
    { key: 'project', header: t('columns.project'), cell: (row) => row.project.title },
    {
      key: 'contributor',
      header: t('columns.contributor'),
      cell: (row) =>
        row.contributor?.displayName ?? (row.anonymous ? t('anonymous') : common('deletedMember')),
    },
    {
      key: 'kind',
      header: t('columns.kind'),
      cell: (row) => reference(`contributionKinds.${row.kind}`),
    },
    {
      key: 'method',
      header: t('columns.method'),
      cell: (row) => reference(`paymentMethods.${row.method}`),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => reference(`contributionStatuses.${row.status}`),
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      align: 'end',
      cell: (row) => <Money amount={row.amount} precision="financial" />,
    },
  ];
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminPaymentsControllerSearch({ ...query, cursor, limit: 25 });
      setRows((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="grid gap-3">
      <Table
        caption={t('caption')}
        hideCaption
        density="compact"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        hasMore={cursor !== null}
        onLoadMore={() => void more()}
        loadingMore={loading}
        empty={<EmptyState size="inline" title={t('empty')} description={t('emptyHint')} />}
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
