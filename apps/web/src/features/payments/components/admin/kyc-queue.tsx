'use client';

import { adminPaymentsControllerKycQueue } from '@pitchorium/api-client';
import type { CursorPage, KycSubmission } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, EmptyState, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleProblem } from '@/features/admin';
import { Link } from '@/i18n/navigation';

const TONES = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;

/** The identity verifications of the holders (§9.5), oldest pending first as the api lists them. */
export function KycQueue({
  page,
  status,
}: {
  page: CursorPage<KycSubmission>;
  status: KycSubmission['status'] | undefined;
}) {
  const t = useTranslations('web.admin.payments.kyc');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columns: TableColumn<KycSubmission>[] = [
    {
      key: 'holder',
      header: t('columns.holder'),
      rowHeader: true,
      cell: (row) => (
        <Link href={routes.adminKycSubmission(row.id)} className="link-underline-hover text-accent">
          {row.holder?.displayName ?? common('deletedMember')}
        </Link>
      ),
    },
    {
      key: 'submitted',
      header: t('columns.submitted'),
      cell: (row) => (
        <span className="font-numeric tabular-nums">
          {format.dateTime(new Date(row.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'documents',
      header: t('columns.documents'),
      align: 'end',
      cell: (row) => (
        <span className="font-numeric tabular-nums">{row.documentMediaIds.length}</span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => (
        <Badge tone={TONES[row.status]}>{reference(`kycReviewStatuses.${row.status}`)}</Badge>
      ),
    },
  ];
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminPaymentsControllerKycQueue({
        ...(status ? { status } : {}),
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
