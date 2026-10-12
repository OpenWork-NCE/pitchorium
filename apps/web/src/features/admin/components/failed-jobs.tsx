'use client';

import { adminControllerRetry } from '@pitchorium/api-client';
import type { FailedJob } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  Heading,
  Text,
  useAnnounce,
} from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { useConsoleAction } from './console-access';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useResumeEffect,
  useSensitiveAction,
} from './sensitive-action';
import { useConsoleProblem } from './use-console-problem';

/**
 * The jobs failed for good (§14), by queue: their name, attempts, the reason and the payload as
 * the api masks them (structure, identifiers, dates and codes, never a text or an address). A
 * retry asks for a recent session; it is idempotent: a job already retried or gone says so.
 */
export function FailedJobs({ items }: { items: readonly FailedJob[] }) {
  const t = useTranslations('web.admin.jobs');
  const queues = [...new Set(items.map((item) => item.queue))];
  if (items.length === 0) return <EmptyState title={t('empty')} description={t('emptyHint')} />;
  return (
    <div className="grid gap-8">
      {queues.map((queue) => (
        <section key={queue} aria-labelledby={`queue-${queue}`} className="grid gap-3">
          <Heading level={2} size="section" id={`queue-${queue}`} className="font-mono">
            {queue}
          </Heading>
          <ul className="grid gap-3">
            {items
              .filter((item) => item.queue === queue)
              .map((item) => (
                <li key={item.id}>
                  <JobCard job={item} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function JobCard({ job }: { job: FailedJob }) {
  const t = useTranslations('web.admin.jobs');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const retry = useConsoleAction('admin.jobs.retry');
  const resumeKey = `job:${job.queue}:${job.id}`;
  const sensitive = useSensitiveAction(resumeKey);
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One key per job: a second click never retries twice.
  const [key] = useState(() => crypto.randomUUID());
  useResumeEffect(sensitive.resumed, () => setConfirming(true), sensitive.acknowledge);
  async function submit() {
    setError(null);
    try {
      const result = await sensitive.run(() =>
        adminControllerRetry(job.queue, job.id, { headers: { 'Idempotency-Key': key } }),
      );
      if (!result.done) return;
      const message = t(`outcomes.${result.value.outcome}`);
      setOutcome(message);
      announce(message);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  const titleId = `job-${job.queue}-${job.id}`;
  return (
    <Card className="grid gap-3 p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={3} size="card" id={titleId} className="font-mono">
          {job.name}
        </Heading>
        <Badge tone="danger">{t('failed')}</Badge>
      </div>
      <DescriptionList
        items={[
          {
            key: 'id',
            term: t('id'),
            description: <code className="font-mono text-sm break-all">{job.id}</code>,
          },
          {
            key: 'attempts',
            term: t('attempts'),
            description: <span className="font-numeric tabular-nums">{job.attemptsMade}</span>,
          },
          {
            key: 'failedAt',
            term: t('failedAt'),
            description: job.failedAt
              ? format.dateTime(new Date(job.failedAt), { dateStyle: 'medium', timeStyle: 'short' })
              : '–',
          },
          { key: 'reason', term: t('reason'), description: job.failedReason ?? '–' },
        ]}
      />
      <div className="grid gap-1">
        <Text size="sm" weight="medium">
          {t('payload')}
        </Text>
        <pre className="max-h-64 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs">
          {JSON.stringify(job.data, null, 2)}
        </pre>
        <Text size="xs" tone="muted">
          {t('masked')}
        </Text>
      </div>
      {retry.visible ? (
        <div className="grid gap-2">
          <RecentSessionHint />
          {sensitive.stale ? <ReauthenticationNotice resumeKey={resumeKey} /> : null}
          <AlertDialog
            trigger={
              <Button
                variant="secondary"
                className="justify-self-start"
                disabledReason={retry.disabledReason ?? (outcome ? outcome : undefined)}
              >
                {t('retry')}
              </Button>
            }
            open={confirming}
            onOpenChange={setConfirming}
            tone="primary"
            title={t('retryTitle', { name: job.name })}
            description={t('retryDescription')}
            confirmLabel={t('retry')}
            onConfirm={submit}
          />
          {outcome ? (
            <p role="status" className="text-sm">
              {outcome}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
