'use client';

import {
  adminPaymentsControllerDiscrepancies,
  adminPaymentsControllerReconcile,
  adminPaymentsControllerResolve,
} from '@pitchorium/api-client';
import type { CursorPage, Discrepancy } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DescriptionList,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  Heading,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';

/** Longest note of a resolution (DECISION_REASON_MAX_LENGTH of the contracts). */
const NOTE_MAX = 1_000;

/**
 * The discrepancies of the daily reconciliation (ADR 0048): what the provider and the ledger say,
 * the contribution concerned, and how it was handled. Nothing is corrected automatically: the
 * administrator records a note once the fix is made; a run can be launched now.
 */
export function Discrepancies({
  page,
  status,
}: {
  page: CursorPage<Discrepancy>;
  status: Discrepancy['status'] | undefined;
}) {
  const t = useTranslations('web.admin.payments.discrepancies');
  const common = useTranslations('web.admin.common');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const manage = useConsoleAction('payment.reconciliation.manage');
  const [items, setItems] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{ checked: number; found: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminPaymentsControllerDiscrepancies({
        ...(status ? { status } : {}),
        cursor,
        limit: 20,
      });
      setItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  async function run() {
    setRunning(true);
    setError(null);
    try {
      const result = await adminPaymentsControllerReconcile();
      const summary = { checked: result.checkedTransactions, found: result.discrepancies.length };
      setReport(summary);
      announce(t('runDone', summary));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="grid gap-4">
      <Text size="sm" tone="muted" prose>
        {t('valuesHint')}
      </Text>
      {manage.visible ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Text size="sm" tone="muted" prose>
            {t('runHint')}
          </Text>
          <Button
            variant="secondary"
            loading={running}
            loadingLabel={t('running')}
            disabledReason={manage.disabledReason}
            onClick={() => void run()}
          >
            {t('run')}
          </Button>
        </div>
      ) : null}
      {report ? (
        <p role="status" className="text-sm">
          {t('runDone', report)}
        </p>
      ) : null}
      {items.length === 0 ? (
        <EmptyState
          title={t(status === 'resolved' ? 'emptyResolved' : 'empty')}
          description={t('emptyHint')}
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <DiscrepancyCard
                item={item}
                disabledReason={manage.disabledReason}
                canResolve={manage.visible}
              />
            </li>
          ))}
        </ul>
      )}
      {cursor ? (
        <Button
          variant="outline"
          className="justify-self-center"
          loading={loading}
          loadingLabel={common('loadMore')}
          onClick={() => void more()}
        >
          {common('loadMore')}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DiscrepancyCard({
  item,
  canResolve,
  disabledReason,
}: {
  item: Discrepancy;
  canResolve: boolean;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.payments.discrepancies');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const titleId = `discrepancy-${item.id}`;
  return (
    <Card className="grid gap-3 p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} size="card" id={titleId}>
          {reference(`discrepancyKinds.${item.kind}`)}
        </Heading>
        <Badge tone={item.status === 'open' ? 'warning' : 'success'}>
          {reference(`discrepancyStatuses.${item.status}`)}
        </Badge>
      </div>
      <DescriptionList
        items={[
          {
            key: 'reference',
            term: t('reference'),
            description: <code className="font-mono text-sm">{item.reference}</code>,
          },
          {
            key: 'provider',
            term: t('provider'),
            // A provider the api names by a known code is said in words (reference).
            description: item.provider
              ? reference.has(`paymentProviders.${item.provider}` as never)
                ? reference(`paymentProviders.${item.provider}` as never)
                : item.provider
              : common('none'),
          },
          {
            key: 'expected',
            term: t('expected'),
            description: <span className="font-numeric tabular-nums">{item.expected ?? '–'}</span>,
          },
          {
            key: 'actual',
            term: t('actual'),
            description: <span className="font-numeric tabular-nums">{item.actual ?? '–'}</span>,
          },
          {
            key: 'contribution',
            term: t('contribution'),
            description: item.contributionId ? (
              <Link
                href={routes.adminContribution(item.contributionId)}
                className="link-underline-hover text-accent"
              >
                {t('openContribution')}
              </Link>
            ) : (
              common('none')
            ),
          },
          { key: 'detected', term: t('detected'), description: date(item.detectedAt) },
        ]}
      />
      {item.status === 'resolved' ? (
        <div className="grid gap-1 rounded-md bg-surface-sunken p-3 text-sm">
          <span className="text-muted">
            {item.resolvedAt ? t('resolvedAt', { date: date(item.resolvedAt) }) : null}
          </span>
          <span className="whitespace-pre-line">{item.resolution}</span>
        </div>
      ) : canResolve ? (
        <ResolveDialog item={item} disabledReason={disabledReason} />
      ) : null}
    </Card>
  );
}

function ResolveDialog({
  item,
  disabledReason,
}: {
  item: Discrepancy;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.payments.discrepancies');
  const reference = useTranslations('reference');
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      await adminPaymentsControllerResolve(item.id, { note: note.trim() });
      announce(t('resolvedDone'));
      setOpen(false);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="justify-self-start" disabledReason={disabledReason}>
          {t('resolve')}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t('resolveTitle', { kind: reference(`discrepancyKinds.${item.kind}`) })}
        description={t('resolveDescription')}
      >
        <Field
          label={t('note')}
          description={t('noteHint')}
          counter={{ count: note.length, max: NOTE_MAX }}
        >
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            minRows={3}
            maxLength={NOTE_MAX}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <DialogActions>
          <Button
            loading={busy}
            loadingLabel={t('resolving')}
            disabledReason={note.trim().length === 0 ? t('noteMissing') : undefined}
            onClick={() => void resolve()}
          >
            {t('resolve')}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
