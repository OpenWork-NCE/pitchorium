'use client';

import { moderationControllerQueue } from '@pitchorium/api-client';
import type {
  CursorPage,
  ModerationCase,
  ModerationPerson,
  ModerationQueueQuery,
} from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, EmptyState, RelativeTime, Table, type TableColumn, Tooltip } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleProblem } from '@/features/admin';
import { Link } from '@/i18n/navigation';

/** The words of a reason of the priority the api gives (`reason:fraud`, `reports:3`...). */
function usePriorityReason(): (reason: string) => string {
  const t = useTranslations('web.admin.moderation.priority');
  const reference = useTranslations('reference.reportReasons');
  return (reason) => {
    const [kind, value] = reason.split(':');
    if (kind === 'reason' && value) return t('reason', { reason: reference(value as never) });
    if (kind === 'reports' && value) return t('reports', { count: value });
    if (kind === 'signal' && value) return t('signalKind', { kind: value });
    if (kind === 'funding_fraud' || kind === 'signal') return t(kind);
    return reason;
  };
}

/**
 * The moderation queue as the api orders it (§13): the highest priority first (fraud on a
 * project in funding before everything), then the oldest. Each case shows its priority and why,
 * its target, the member concerned, its reasons, its reports, its age and who handles it.
 */
export function ModerationQueue({
  page,
  query,
  moderators,
}: {
  page: CursorPage<ModerationCase>;
  /** The filters of the page, for the next pages. */
  query: Omit<ModerationQueueQuery, 'cursor' | 'limit'>;
  moderators: readonly ModerationPerson[];
}) {
  const t = useTranslations('web.admin.moderation');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const priorityReason = usePriorityReason();
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = new Map(moderators.map((person) => [person.userId, person.name]));
  const columns: TableColumn<ModerationCase>[] = [
    {
      key: 'priority',
      header: t('columns.priority'),
      align: 'end',
      cell: (row) => (
        <Tooltip
          content={row.priorityReasons.map(priorityReason).join(' · ') || t('noPriorityReason')}
        >
          <button
            type="button"
            className="rounded-sm font-numeric font-semibold tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-focus"
          >
            {format.number(row.priority)}
            <span className="sr-only">
              {' · '}
              {row.priorityReasons.map(priorityReason).join(' · ')}
            </span>
          </button>
        </Tooltip>
      ),
    },
    {
      key: 'target',
      header: t('columns.target'),
      rowHeader: true,
      cell: (row) => (
        <Link
          href={routes.adminCase(row.id)}
          className="link-underline-hover font-medium text-accent"
        >
          {reference(`reportTargetTypes.${row.targetType}`)}
        </Link>
      ),
    },
    {
      key: 'subject',
      header: t('columns.subject'),
      cell: (row) => row.subject?.name ?? common('deletedMember'),
    },
    {
      key: 'reasons',
      header: t('columns.reasons'),
      cell: (row) =>
        row.origin === 'signal' ? (
          <Badge tone="info">{t('origins.signal')}</Badge>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.reasons.map((reason) => (
              <Badge
                key={reason}
                tone={reason === 'illegal_content' || reason === 'fraud' ? 'danger' : 'neutral'}
              >
                {reference(`reportReasons.${reason}`)}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: 'reports',
      header: t('columns.reports'),
      align: 'end',
      cell: (row) => (
        <span className="font-numeric tabular-nums">{format.number(row.reportCount)}</span>
      ),
    },
    {
      key: 'age',
      header: t('columns.opened'),
      cell: (row) => <RelativeTime date={row.createdAt} />,
    },
    {
      key: 'assigned',
      header: t('columns.assigned'),
      cell: (row) =>
        row.assignedTo ? (names.get(row.assignedTo) ?? common('unknown')) : t('unassigned'),
    },
  ];
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await moderationControllerQueue({ ...query, cursor, limit: 25 });
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
        caption={t('queueCaption')}
        hideCaption
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        density="compact"
        hasMore={cursor !== null}
        onLoadMore={() => void more()}
        loadingMore={loading}
        empty={
          <EmptyState size="inline" title={t('emptyQueue')} description={t('emptyQueueHint')} />
        }
      />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
