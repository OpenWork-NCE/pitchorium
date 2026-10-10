'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import {
  engagementControllerConfirm,
  engagementControllerDeclare,
  engagementControllerDeclared,
  engagementControllerDispute,
  engagementControllerReceived,
  getEngagementControllerDeclaredQueryKey,
  getEngagementControllerReceivedQueryKey,
} from '@pitchorium/api-client';
import type { TimeEntry, TimeEntryKind } from '@pitchorium/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  ErrorState,
  Field,
  Heading,
  Input,
  Loading,
  Pagination,
  RadioGroup,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { hoursAndMinutes } from '../lib/chart';
import { TIME_LIMITS } from '../lib/limits';
import type { SupportedProject } from './engagement-dashboard';

const TONES = { declared: 'info', confirmed: 'success', disputed: 'warning' } as const;

function useProblem() {
  const errors = useTranslations('errors');
  const t = useTranslations('web.engagement.time');
  return (error: unknown) =>
    error instanceof ApiProblemError
      ? errors.has(error.problem.code as never)
        ? errors(error.problem.code as never)
        : errors('INTERNAL_ERROR')
      : t('network');
}

/** Today in the time zone of the browser, as a calendar day (`2026-10-10`). */
function today(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** The declaration of hours of mentoring or expertise, for a project or an entrepreneur. */
function DeclareDialog({
  open,
  onOpenChange,
  projects,
  onDeclared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly SupportedProject[];
  onDeclared: () => void;
}) {
  const t = useTranslations('web.engagement.time.declare');
  const kinds = useTranslations('reference.timeEntryKinds');
  const problem = useProblem();
  const [target, setTarget] = useState<'project' | 'entrepreneur'>(
    projects.length > 0 ? 'project' : 'entrepreneur',
  );
  const [projectId, setProjectId] = useState<string | undefined>(projects[0]?.id);
  const [handle, setHandle] = useState('');
  const [kind, setKind] = useState<TimeEntryKind>('mentoring');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const total = Number.parseInt(hours || '0', 10) * 60 + Number.parseInt(minutes || '0', 10);
  const valid =
    Number.isInteger(total) &&
    total >= 1 &&
    total <= TIME_LIMITS.maxMinutes &&
    description.trim().length > 0 &&
    (target === 'project' ? Boolean(projectId) : handle.trim().length > 0);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await engagementControllerDeclare(
        {
          ...(target === 'project'
            ? { projectId: projectId! }
            : { entrepreneurHandle: handle.trim() }),
          kind,
          minutes: total,
          date,
          description: description.trim(),
        },
        { headers: { 'Idempotency-Key': key.current } },
      );
      key.current = crypto.randomUUID();
      setDescription('');
      onDeclared();
      onOpenChange(false);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description')} size="lg">
        <div className="grid gap-5">
          <Field label={t('target')}>
            <RadioGroup
              value={target}
              onValueChange={setTarget}
              options={[
                { value: 'project' as const, label: t('project'), disabled: projects.length === 0 },
                { value: 'entrepreneur' as const, label: t('entrepreneur') },
              ]}
            />
          </Field>
          {target === 'project' ? (
            <Field label={t('projectLabel')} description={t('projectHint')}>
              <Select
                value={projectId}
                onValueChange={setProjectId}
                options={projects.map((project) => ({ value: project.id, label: project.title }))}
              />
            </Field>
          ) : (
            <Field label={t('handle')} description={t('handleHint')}>
              <Input
                value={handle}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setHandle(event.target.value)}
              />
            </Field>
          )}
          <Field label={t('kind')}>
            <RadioGroup
              value={kind}
              onValueChange={setKind}
              options={(['mentoring', 'expertise'] as const).map((value) => ({
                value,
                label: kinds(value),
              }))}
            />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('duration')}</legend>
            <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
              <Field label={t('hours')}>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  inputMode="numeric"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                />
              </Field>
              <Field label={t('minutes')}>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </Field>
            </div>
            <p className="text-sm text-muted">{t('durationHint')}</p>
          </fieldset>
          <Field label={t('date')} description={t('dateHint')}>
            <Input
              type="date"
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field
            label={t('descriptionLabel')}
            counter={{ count: description.length, max: TIME_LIMITS.description }}
          >
            <Textarea
              value={description}
              maxLength={TIME_LIMITS.description}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          {error ? (
            <Alert tone="danger" live="alert">
              {error}
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              loading={busy}
              loadingLabel={t('declaring')}
              disabledReason={valid ? undefined : t('incomplete')}
              onClick={() => void submit()}
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  return (
    <div className="grid gap-8">
      <div>
        <Button onClick={() => setOpen(true)}>
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
      <DeclareDialog
        open={open}
        onOpenChange={setOpen}
        projects={projects}
        onDeclared={() =>
          void queryClient.invalidateQueries({
            queryKey: getEngagementControllerDeclaredQueryKey(),
          })
        }
      />
    </div>
  );
}
