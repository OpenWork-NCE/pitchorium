'use client';

import type { VerificationQueue as Queue, VerificationRequest } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { Badge, EmptyState, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';

/**
 * The verification requests of the organisations (§10.7, §13), the oldest first: the
 * organisation, who asked, the documents, the non-decisive signal of the domain, the state.
 */
export function VerificationQueue({ queue }: { queue: Queue }) {
  const t = useTranslations('web.admin.verification');
  const format = useFormatter();
  const common = useTranslations('web.admin.common');
  const columns: TableColumn<VerificationRequest>[] = [
    {
      key: 'organization',
      header: t('columns.organization'),
      rowHeader: true,
      cell: (row) => (
        <Link
          href={routes.adminVerification(row.id)}
          className="link-underline-hover font-medium text-accent"
        >
          {row.organization.name}
        </Link>
      ),
    },
    {
      key: 'requester',
      header: t('columns.requester'),
      cell: (row) => row.requester?.name ?? common('deletedMember'),
    },
    {
      key: 'documents',
      header: t('columns.documents'),
      align: 'end',
      cell: (row) => (
        <span className="font-numeric tabular-nums">
          {format.number(row.documentMediaIds.length)}
        </span>
      ),
    },
    {
      key: 'domain',
      header: t('columns.domain'),
      cell: (row) =>
        row.signals.websiteDomain ? (
          <span className="flex flex-wrap items-center gap-1">
            {row.signals.websiteDomain}
            {row.signals.memberEmailOnWebsiteDomain ? (
              <Badge tone="info">{t('domainMatch')}</Badge>
            ) : null}
          </span>
        ) : (
          t('noWebsite')
        ),
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
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => (
        <Badge
          tone={
            row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'
          }
        >
          {t(`status.${row.status}`)}
        </Badge>
      ),
    },
  ];
  return (
    <Table
      caption={t('caption')}
      hideCaption
      density="compact"
      columns={columns}
      rows={queue.items}
      rowKey={(row) => row.id}
      empty={<EmptyState size="inline" title={t('empty')} description={t('emptyHint')} />}
    />
  );
}
