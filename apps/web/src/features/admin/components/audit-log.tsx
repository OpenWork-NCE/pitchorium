'use client';

import { adminControllerAuditExport, adminControllerAuditLog } from '@pitchorium/api-client';
import type { AuditEntry, CursorPage } from '@pitchorium/contracts';
import { Download } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import { useState, useTransition } from 'react';
import {
  Button,
  DateTimeField,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  Input,
  Table,
  type TableColumn,
} from '@/components/ui';
import { downloadCsv } from '@/lib/files/download-csv';
import { type AuditFilters, auditQueryOf } from '../lib/audit-query';
import { useConsoleAction } from './console-access';
import { useConsoleProblem } from './use-console-problem';

const TEXT_FILTERS = ['actorId', 'action', 'targetType', 'targetId'] as const;

/**
 * The audit log (§13, §14), filtered in the address by actor, action, target and period, newest
 * first; each entry opens its detail (metadata, request), and the filtered log exports in CSV
 * (at most AUDIT_EXPORT_MAX rows, the export itself audited).
 */
export function AuditLog({
  page,
  filters,
}: {
  page: CursorPage<AuditEntry>;
  filters: AuditFilters;
}) {
  const t = useTranslations('web.admin.audit');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const exportAction = useConsoleAction('admin.audit.export');
  const [rows, setRows] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' });
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminControllerAuditLog({ ...auditQueryOf(filters), cursor, limit: 50 });
      setRows((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      downloadCsv(await adminControllerAuditExport(auditQueryOf(filters)), 'audit-log.csv');
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setExporting(false);
    }
  }
  const columns: TableColumn<AuditEntry>[] = [
    {
      key: 'occurred',
      header: t('columns.occurred'),
      rowHeader: true,
      cell: (row) => (
        <span className="font-numeric whitespace-nowrap tabular-nums">{date(row.occurredAt)}</span>
      ),
    },
    {
      key: 'actor',
      header: t('columns.actor'),
      cell: (row) => (
        <span className="font-mono text-xs break-all">
          {row.actorType}
          {row.actorId ? `:${row.actorId}` : ''}
        </span>
      ),
    },
    {
      key: 'action',
      header: t('columns.action'),
      cell: (row) => <span className="font-mono text-xs">{row.action}</span>,
    },
    {
      key: 'target',
      header: t('columns.target'),
      cell: (row) => (
        <span className="font-mono text-xs break-all">
          {row.targetType}:{row.targetId}
        </span>
      ),
    },
    {
      key: 'detail',
      header: t('columns.detail'),
      actions: true,
      cell: (row) => <EntryDetail entry={row} occurred={date(row.occurredAt)} />,
    },
  ];
  return (
    <div className="grid gap-4">
      <AuditFiltersForm filters={filters} />
      {exportAction.visible ? (
        <Button
          variant="outline"
          className="justify-self-start"
          loading={exporting}
          loadingLabel={t('exporting')}
          disabledReason={exportAction.disabledReason}
          onClick={() => void exportCsv()}
        >
          <Download aria-hidden />
          {t('export')}
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
        rows={rows}
        rowKey={(row) => row.id}
        hasMore={cursor !== null}
        onLoadMore={() => void more()}
        loadingMore={loading}
        empty={<EmptyState size="inline" title={t('empty')} description={t('emptyHint')} />}
      />
      <p className="text-xs text-muted">{t('utc')}</p>
    </div>
  );
}

function AuditFiltersForm({ filters }: { filters: AuditFilters }) {
  const t = useTranslations('web.admin.audit');
  const [pending, startTransition] = useTransition();
  const [, setQuery] = useQueryStates(
    {
      actorId: parseAsString,
      action: parseAsString,
      targetType: parseAsString,
      targetId: parseAsString,
      from: parseAsString,
      to: parseAsString,
    },
    { shallow: false, startTransition },
  );
  const [draft, setDraft] = useState<AuditFilters>(filters);
  const clean = (value: string | undefined) =>
    value && value.trim().length > 0 ? value.trim() : null;
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void setQuery({
          actorId: clean(draft.actorId),
          action: clean(draft.action),
          targetType: clean(draft.targetType),
          targetId: clean(draft.targetId),
          from: draft.from ?? null,
          to: draft.to ?? null,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEXT_FILTERS.map((name) => (
          <Field key={name} label={t(`filters.${name}`)}>
            <Input
              value={draft[name] ?? ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [name]: event.target.value }))
              }
              maxLength={name === 'action' ? 80 : 64}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        ))}
        <Field label={t('filters.from')}>
          <DateTimeField
            granularity="day"
            value={draft.from ?? null}
            onChange={(value) => setDraft((current) => ({ ...current, from: value ?? undefined }))}
          />
        </Field>
        <Field label={t('filters.to')}>
          <DateTimeField
            granularity="day"
            value={draft.to ?? null}
            onChange={(value) => setDraft((current) => ({ ...current, to: value ?? undefined }))}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" loading={pending} loadingLabel={t('apply')}>
          {t('apply')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDraft({});
            void setQuery({
              actorId: null,
              action: null,
              targetType: null,
              targetId: null,
              from: null,
              to: null,
            });
          }}
        >
          {t('reset')}
        </Button>
      </div>
    </form>
  );
}

function EntryDetail({ entry, occurred }: { entry: AuditEntry; occurred: string }) {
  const t = useTranslations('web.admin.audit');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {t('open')}
        </Button>
      </DialogTrigger>
      <DialogContent title={entry.action} description={occurred} size="lg">
        <dl className="grid gap-2 text-sm">
          {(
            [
              ['actor', `${entry.actorType}${entry.actorId ? `:${entry.actorId}` : ''}`],
              ['target', `${entry.targetType}:${entry.targetId}`],
              ['request', entry.requestId ?? '–'],
              ['id', entry.id],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="grid gap-0.5">
              <dt className="text-muted">{t(`detail.${key}`)}</dt>
              <dd className="font-mono text-xs break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-1">
          <p className="text-sm text-muted">{t('detail.metadata')}</p>
          <pre className="max-h-80 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
