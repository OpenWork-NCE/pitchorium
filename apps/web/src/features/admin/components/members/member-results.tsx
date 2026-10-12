'use client';

import { adminControllerMembers } from '@pitchorium/api-client';
import type { CursorPage, MemberSummary } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, EmptyState, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { useConsoleProblem } from '../use-console-problem';

/** Members found by the search of the console (email, name or exact handle), audited by the api. */
export function MemberResults({ query, page }: { query: string; page: CursorPage<MemberSummary> }) {
  const t = useTranslations('web.admin.members');
  const roles = useTranslations('reference.roles');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columns: TableColumn<MemberSummary>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      rowHeader: true,
      cell: (row) => (
        <Link
          href={routes.adminMember(row.userId)}
          className="link-underline-hover font-medium text-accent"
        >
          {row.name}
        </Link>
      ),
    },
    { key: 'email', header: t('columns.email'), cell: (row) => row.email },
    { key: 'handle', header: t('columns.handle'), cell: (row) => row.handle ?? '–' },
    {
      key: 'roles',
      header: t('columns.roles'),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.roles
            .filter((role) => role !== 'member')
            .map((role) => (
              <Badge key={role} tone="accent">
                {roles(role)}
              </Badge>
            ))}
        </span>
      ),
    },
    {
      key: 'email-verified',
      header: t('columns.emailVerified'),
      cell: (row) => (row.emailVerified ? t('verified') : t('notVerified')),
    },
    {
      key: 'created',
      header: t('columns.createdAt'),
      align: 'end',
      cell: (row) => (
        <span className="font-numeric tabular-nums">
          {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}
        </span>
      ),
    },
  ];
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminControllerMembers({ q: query, cursor, limit: 25 });
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
        caption={t('results', { query })}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.userId}
        density="compact"
        hasMore={cursor !== null}
        onLoadMore={() => void more()}
        loadingMore={loading}
        empty={<EmptyState size="inline" title={t('noResult')} description={t('noResultHint')} />}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
