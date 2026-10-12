'use client';

import { methodologiesControllerCreate } from '@pitchorium/api-client';
import type { AdminImpactMethodology } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, EmptyState, Table, type TableColumn } from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';
import { draftOf, newCriterion } from '../../lib/draft';

const TONES = { draft: 'neutral', published: 'success', archived: 'neutral' } as const;

/**
 * The versions of the impact methodology (§12, ADR 0036), newest first: one published at most,
 * drafts to prepare the next, archives kept for the scores that cite them. A new draft starts
 * from the published version.
 */
export function MethodologyList({ items }: { items: readonly AdminImpactMethodology[] }) {
  const t = useTranslations('web.admin.impact');
  const reference = useTranslations('reference');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const router = useRouter();
  const manage = useConsoleAction('impact.methodology.manage');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const published = items.find((item) => item.status === 'published');
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: 'medium' }) : '–';
  async function create() {
    setBusy(true);
    setError(null);
    try {
      const created = await methodologiesControllerCreate(
        published
          ? { ...draftOf(published), name: t('copyName', { name: published.name }) }
          : { name: t('newName'), criteria: [newCriterion([])] },
        { headers: { 'Idempotency-Key': key } },
      );
      router.push(routes.adminMethodology(created.id));
    } catch (failure) {
      setError(problem(failure));
      setBusy(false);
    }
  }
  const columns: TableColumn<AdminImpactMethodology>[] = [
    {
      key: 'version',
      header: t('columns.version'),
      rowHeader: true,
      cell: (row) => (
        <Link href={routes.adminMethodology(row.id)} className="link-underline-hover text-accent">
          {t('versionName', { version: row.version, name: row.name })}
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          <Badge tone={TONES[row.status]}>
            {reference(`impactMethodologyStatuses.${row.status}`)}
          </Badge>
          {row.demo ? <Badge tone="warning">{t('demo')}</Badge> : null}
        </span>
      ),
    },
    {
      key: 'criteria',
      header: t('columns.criteria'),
      align: 'end',
      cell: (row) => <span className="font-numeric tabular-nums">{row.criteria.length}</span>,
    },
    {
      key: 'labels',
      header: t('columns.labels'),
      cell: (row) =>
        row.labelCoverage.missing.length === 0 ? (
          <span className="text-muted">{t('labelsComplete')}</span>
        ) : (
          <Badge tone="warning">
            {t('labelsMissing', { count: row.labelCoverage.missing.length })}
          </Badge>
        ),
    },
    { key: 'created', header: t('columns.created'), cell: (row) => date(row.createdAt) },
    { key: 'published', header: t('columns.published'), cell: (row) => date(row.publishedAt) },
  ];
  return (
    <div className="grid gap-4">
      {manage.visible ? (
        <Button
          className="justify-self-start"
          loading={busy}
          loadingLabel={t('creating')}
          disabledReason={manage.disabledReason}
          onClick={() => void create()}
        >
          {published ? t('createFromPublished', { version: published.version }) : t('create')}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Table
        caption={t('caption')}
        hideCaption
        density="compact"
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        empty={<EmptyState size="inline" title={t('empty')} description={t('emptyHint')} />}
      />
    </div>
  );
}
