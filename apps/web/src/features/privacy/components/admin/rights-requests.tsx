'use client';

import { privacyControllerRightsRequests } from '@pitchorium/api-client';
import type { CursorPage, RightsRequest } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, EmptyState, RelativeTime, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleProblem } from '@/features/admin';
import { Link } from '@/i18n/navigation';

/**
 * The rights requests of the members (§13, RGPD articles 12, 15, 17, 20): exports and erasures
 * with their state and the legal deadline of the answer (one month) that the api computes, an
 * overdue request in the danger tone; the content of the data is never shown.
 */
export function RightsRequests({
  page,
  kind,
}: {
  page: CursorPage<RightsRequest>;
  kind: RightsRequest['kind'] | undefined;
}) {
  const t = useTranslations('web.admin.rights');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const statusOf = (row: RightsRequest) => {
    const key = `${row.kind}Statuses.${row.status}`;
    return reference.has(key as never) ? reference(key as never) : row.status;
  };
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await privacyControllerRightsRequests({
        ...(kind ? { kind } : {}),
        cursor,
        limit: 25,
      });
      setRows((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  const columns: TableColumn<RightsRequest>[] = [
    {
      key: 'requested',
      header: t('columns.requested'),
      rowHeader: true,
      cell: (row) => <span className="font-numeric tabular-nums">{date(row.requestedAt)}</span>,
    },
    {
      key: 'kind',
      header: t('columns.kind'),
      cell: (row) => reference(`rightsRequestKinds.${row.kind}`),
    },
    {
      key: 'member',
      header: t('columns.member'),
      cell: (row) =>
        row.userId ? (
          <Link href={routes.adminMember(row.userId)} className="link-underline-hover text-accent">
            {t('openFile')}
          </Link>
        ) : (
          <span className="text-muted">{t('erased')}</span>
        ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => (
        <Badge tone={row.status === 'failed' || row.status === 'blocked' ? 'danger' : 'neutral'}>
          {statusOf(row)}
        </Badge>
      ),
    },
    {
      key: 'due',
      header: t('columns.due'),
      cell: (row) =>
        row.overdue ? (
          <span className="grid gap-0.5">
            <Badge tone="danger">{t('overdue')}</Badge>
            <span className="font-numeric text-sm text-danger tabular-nums">{date(row.dueAt)}</span>
          </span>
        ) : row.answered ? (
          <span className="font-numeric text-muted tabular-nums">{date(row.dueAt)}</span>
        ) : (
          <span className="grid gap-0.5">
            <span className="font-numeric font-medium tabular-nums">{date(row.dueAt)}</span>
            <RelativeTime date={row.dueAt} className="text-xs text-muted" />
          </span>
        ),
    },
    {
      key: 'completed',
      header: t('columns.completed'),
      cell: (row) =>
        row.completedAt ? (
          <span className="font-numeric tabular-nums">{date(row.completedAt)}</span>
        ) : (
          '–'
        ),
    },
    { key: 'detail', header: t('columns.detail'), cell: (row) => row.detail ?? '–' },
  ];
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
