'use client';

import { adminControllerFeature, adminControllerUnfeature } from '@pitchorium/api-client';
import type { Highlight, HighlightTargetType } from '@pitchorium/contracts';
import { ArrowUpToLine, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  EmptyState,
  Field,
  Heading,
  IconButton,
  Input,
  Select,
  Table,
  type TableColumn,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { Link, useRouter } from '@/i18n/navigation';
import { useConsoleProblem } from './use-console-problem';

const TYPES: readonly HighlightTargetType[] = ['post', 'project', 'profile'];

/** The address of what is featured, when the web has one by this identifier. */
function hrefOf(item: Highlight): string | null {
  if (item.targetType === 'post') return routes.post(item.targetId);
  if (item.targetType === 'profile') return routes.member(item.targetId);
  return null;
}

/**
 * The editorial highlights (§13), one interface for the publications, the projects and the
 * profiles: in their order of display (the latest featured first), moved to the top by
 * featuring them again, removed with a confirmation; a new one is added by its identifier.
 */
export function Highlights({
  items,
  targetType,
}: {
  items: readonly Highlight[];
  targetType: HighlightTargetType | undefined;
}) {
  const t = useTranslations('web.admin.highlights');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function act(item: Highlight, action: 'top' | 'remove') {
    setBusy(`${item.targetType}:${item.targetId}`);
    setError(null);
    try {
      if (action === 'top') await adminControllerFeature(item.targetType, item.targetId);
      else await adminControllerUnfeature(item.targetType, item.targetId);
      announce(t(action === 'top' ? 'movedDone' : 'removedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(null);
    }
  }
  const columns: TableColumn<Highlight>[] = [
    {
      key: 'position',
      header: t('columns.position'),
      align: 'end',
      cell: (row) => <span className="font-numeric tabular-nums">{row.position}</span>,
    },
    {
      key: 'label',
      header: t('columns.label'),
      rowHeader: true,
      cell: (row) => {
        const href = hrefOf(row);
        const label = row.label ?? row.targetId;
        return href ? (
          <Link href={href} className="link-underline-hover text-accent">
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    { key: 'type', header: t('columns.type'), cell: (row) => t(`types.${row.targetType}`) },
    {
      key: 'featured',
      header: t('columns.featured'),
      cell: (row) =>
        format.dateTime(new Date(row.featuredAt), { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      key: 'actions',
      header: t('columns.actions'),
      actions: true,
      cell: (row) => {
        const id = `${row.targetType}:${row.targetId}`;
        const label = row.label ?? row.targetId;
        return (
          <span className="flex justify-end gap-1">
            <IconButton
              size="sm"
              variant="ghost"
              label={t('moveTop', { label })}
              icon={<ArrowUpToLine aria-hidden />}
              disabled={row.position === 1 || busy === id}
              onClick={() => void act(row, 'top')}
            />
            <AlertDialog
              trigger={
                <IconButton
                  size="sm"
                  variant="ghost"
                  label={t('remove', { label })}
                  icon={<Trash2 aria-hidden />}
                  disabled={busy === id}
                />
              }
              title={t('removeTitle', { label })}
              description={t('removeDescription')}
              confirmLabel={t('removeAction')}
              onConfirm={() => act(row, 'remove')}
            />
          </span>
        );
      },
    },
  ];
  return (
    <div className="grid gap-6">
      <AddHighlight defaultType={targetType ?? 'project'} />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Table
        caption={t('caption')}
        hideCaption
        density="compact"
        columns={targetType ? columns.filter((column) => column.key !== 'type') : columns}
        rows={items}
        rowKey={(row) => `${row.targetType}:${row.targetId}`}
        empty={<EmptyState size="inline" title={t('empty')} description={t('emptyHint')} />}
      />
    </div>
  );
}

function AddHighlight({ defaultType }: { defaultType: HighlightTargetType }) {
  const t = useTranslations('web.admin.highlights');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const [type, setType] = useState<HighlightTargetType>(defaultType);
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    setBusy(true);
    setError(null);
    try {
      await adminControllerFeature(type, target.trim().replace(/^@/, ''));
      setTarget('');
      announce(t('addedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-4 p-5" aria-labelledby="add-highlight">
      <Heading level={2} size="card" id="add-highlight">
        {t('add')}
      </Heading>
      <div className="grid items-end gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <Field label={t('columns.type')}>
          <Select
            value={type}
            onValueChange={setType}
            options={TYPES.map((value) => ({ value, label: t(`types.${value}`) }))}
          />
        </Field>
        <Field label={t(`target.${type}`)} description={t(`targetHint.${type}`)}>
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
        <Button
          loading={busy}
          loadingLabel={t('adding')}
          disabledReason={target.trim().length === 0 ? t('targetMissing') : undefined}
          onClick={() => void add()}
        >
          {t('addAction')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
