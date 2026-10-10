'use client';

import {
  engagementControllerConfirm,
  engagementControllerDeclared,
  engagementControllerDispute,
  engagementControllerReceived,
  getEngagementControllerDeclaredQueryKey,
  getEngagementControllerReceivedQueryKey,
} from '@pitchorium/api-client';
import type { TimeEntry } from '@pitchorium/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Loading,
  Pagination,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { hoursAndMinutes } from '../lib/chart';
import { useProblem } from './use-time-problem';
import { TIME_LIMITS } from '../lib/limits';
import type { SupportedProject } from './engagement-dashboard';

const DeclareTimeDialog = lazy(() => import('./declare-time-dialog'));

const TONES = { declared: 'info', confirmed: 'success', disputed: 'warning' } as const;

/** A time entry, with its answer; the beneficiary confirms or disputes (with a reason). */
function EntryCard({
  entry,
  received,
  onChanged,
}: {
  entry: TimeEntry;
  received: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations('web.engagement.time');
  const kinds = useTranslations('reference.timeEntryKinds');
  const statuses = useTranslations('reference.timeEntryStatuses');
  const locale = useLocale();
  const problem = useProblem();
  const [busy, setBusy] = useState<'confirm' | 'dispute' | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { hours, minutes } = hoursAndMinutes(entry.minutes);
  const who = received
    ? (entry.contributor?.displayName ?? t('deleted'))
    : (entry.project?.title ?? entry.entrepreneur?.displayName ?? t('deleted'));

  async function answer(kind: 'confirm' | 'dispute') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'confirm') await engagementControllerConfirm(entry.id);
      else await engagementControllerDispute(entry.id, { reason: reason.trim() });
      setDisputing(false);
      onChanged();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className="grid gap-2 rounded-xl border border-border bg-surface p-4"
      data-testid="time-entry"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="font-medium">{who}</p>
          <p className="text-sm text-muted">
            {t('summary', {
              kind: kinds(entry.kind),
              duration: t('durationValue', { hours, minutes: String(minutes).padStart(2, '0') }),
              date: new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeZone: 'UTC',
              }).format(new Date(`${entry.date}T12:00:00Z`)),
            })}
          </p>
        </div>
        <Badge tone={TONES[entry.status]}>{statuses(entry.status)}</Badge>
      </div>
      <p className="text-sm">{entry.description}</p>
      {entry.status === 'disputed' && entry.disputeReason ? (
        <p className="text-sm text-muted">{t('disputeReason', { reason: entry.disputeReason })}</p>
      ) : null}
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      {received && entry.status === 'declared' ? (
        disputing ? (
          <div className="grid gap-3">
            <Field
              label={t('disputeLabel')}
              counter={{ count: reason.length, max: TIME_LIMITS.description }}
            >
              <Textarea
                value={reason}
                maxLength={TIME_LIMITS.description}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="danger"
                loading={busy === 'dispute'}
                loadingLabel={t('disputing')}
                disabledReason={reason.trim() ? undefined : t('reasonRequired')}
                onClick={() => void answer('dispute')}
              >
                {t('dispute')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDisputing(false)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busy === 'confirm'}
              loadingLabel={t('confirming')}
              onClick={() => void answer('confirm')}
            >
              {t('confirm')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDisputing(true)}>
              {t('dispute')}
            </Button>
          </div>
        )
      ) : null}
    </article>
  );
}

/** A list of time entries, declared or received, paginated by cursor. */
function EntryList({ received }: { received: boolean }) {
  const t = useTranslations('web.engagement.time');
  const problem = useProblem();
  const queryClient = useQueryClient();
  const params = { limit: 20 };
  const queryKey = received
    ? getEngagementControllerReceivedQueryKey(params)
    : getEngagementControllerDeclaredQueryKey(params);
  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) =>
      (received ? engagementControllerReceived : engagementControllerDeclared)(
        { ...params, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
  const items: TimeEntry[] = list.data?.pages.flatMap((page) => page.items) ?? [];
  if (list.isError) {
    return (
      <ErrorState
        size="inline"
        title={t('unreadable')}
        description={problem(list.error)}
        onRetry={() => void list.refetch()}
      />
    );
  }
  if (list.isPending) {
    return (
      <Loading label={t('loading')}>
        <Skeleton className="h-24 w-full" />
      </Loading>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        size="inline"
        title={t(received ? 'emptyReceived' : 'emptyDeclared')}
        description={t(received ? 'emptyReceivedBody' : 'emptyDeclaredBody')}
      />
    );
  }
  return (
    <div className="grid gap-3">
      {items.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          received={received}
          onChanged={() =>
            void queryClient.invalidateQueries({
              queryKey: received
                ? getEngagementControllerReceivedQueryKey()
                : getEngagementControllerDeclaredQueryKey(),
            })
          }
        />
      ))}
      <Pagination
        hasMore={list.hasNextPage}
        loading={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
      />
    </div>
  );
}

/**
 * The shared time log (section 6.3): the member declares hours of mentoring or expertise for a
 * project or an entrepreneur; the beneficiary confirms or disputes them with a reason. Declared,
 * confirmed and disputed, as the dashboard counts them.
 */
export function TimeLog({ projects }: { projects: readonly SupportedProject[] }) {
  const t = useTranslations('web.engagement.time');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <div className="grid gap-8">
      <div>
        <Button
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
        >
          <Plus aria-hidden />
          {t('declareAction')}
        </Button>
      </div>
      <section aria-labelledby="time-received" className="grid gap-4">
        <div className="grid gap-1">
          <Heading level={2} size="section" id="time-received">
            {t('received')}
          </Heading>
          <p className="text-sm text-muted">{t('receivedHint')}</p>
        </div>
        <EntryList received />
      </section>
      <section aria-labelledby="time-declared" className="grid gap-4">
        <Heading level={2} size="section" id="time-declared">
          {t('declared')}
        </Heading>
        <EntryList received={false} />
      </section>
      {mounted ? (
        <Suspense fallback={null}>
          <DeclareTimeDialog
            open={open}
            onOpenChange={setOpen}
            projects={projects}
            onDeclared={() =>
              void queryClient.invalidateQueries({
                queryKey: getEngagementControllerDeclaredQueryKey(),
              })
            }
          />
        </Suspense>
      ) : null}
    </div>
  );
}
