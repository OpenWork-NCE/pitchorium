'use client';

import { reportsControllerMine, standingControllerAppeal } from '@pitchorium/api-client';
import type {
  Appeal,
  CursorPage,
  ModerationDecision,
  ModerationStanding,
  Report,
} from '@pitchorium/contracts';
import { ShieldCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Form,
  FormActions,
  FormField,
  Heading,
  Pagination,
  Text,
  Textarea,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { TRUST_LIMITS } from '../lib/limits';

const appealSchema = () =>
  import('@pitchorium/contracts').then((m) => m.appealDecisionRequestSchema);

/**
 * « Modération » (§13): the active suspension, then each decision that concerns the member with
 * its statement of reasons (facts, ground, automated detection, end of a suspension) and the
 * redress: one appeal per decision until the date the api gives, its state, and the final
 * reasoned decision. Then the reports the member made and their outcome, when the api lets the
 * member read them (not while suspended).
 */
export function ModerationSettings({
  standing,
  reports,
  now,
}: {
  standing: ModerationStanding;
  /** Null when the api refuses the list (a suspended account). */
  reports: CursorPage<Report> | null;
  /** The time of the reading, for the decisions still open to an appeal. */
  now: string;
}) {
  const t = useTranslations('web.trust.moderation');
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'long' });
  const { suspension, decisions } = standing;
  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <Heading level={2} size="section">
          {t('title')}
        </Heading>
        <Text tone="muted">{t('lede')}</Text>
      </div>
      {suspension ? (
        <Alert tone="danger" title={t('suspendedTitle')}>
          {suspension.endsAt
            ? t('suspendedUntil', { date: date(suspension.endsAt) })
            : t('suspendedPermanent')}
        </Alert>
      ) : null}
      <section aria-labelledby="decisions-title" className="grid gap-4">
        <Heading level={3} size="card" id="decisions-title">
          {t('decisionsTitle')}
        </Heading>
        {decisions.length === 0 ? (
          <EmptyState
            size="inline"
            icon={<ShieldCheck />}
            title={t('empty')}
            description={t('emptyBody')}
          />
        ) : (
          <ul className="grid gap-4">
            {decisions.map((decision) => (
              <li key={decision.id}>
                <DecisionCard decision={decision} now={now} date={date} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {reports ? <ReportsSection initial={reports} date={date} /> : null}
    </div>
  );
}

function DecisionCard({
  decision,
  now,
  date,
}: {
  decision: ModerationDecision;
  now: string;
  date: (iso: string) => string;
}) {
  const t = useTranslations('web.trust.moderation');
  const reference = useTranslations('reference');
  const [appeal, setAppeal] = useState<Appeal | null>(decision.appeal);
  const [writing, setWriting] = useState(false);
  const appealable =
    appeal === null &&
    decision.appealableUntil !== null &&
    Date.parse(decision.appealableUntil) > Date.parse(now);
  const titleId = `decision-${decision.id}`;
  return (
    <Card className="grid gap-4 p-5 sm:p-6" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <Heading level={4} size="card" id={titleId} className="scroll-mt-24">
            {reference(`moderationDecisionKinds.${decision.kind}`)}
          </Heading>
          <Text size="sm" tone="muted">
            {t('decidedOn', { date: date(decision.decidedAt) })} ·{' '}
            {t('concerns', { target: reference(`reportTargetTypes.${decision.targetType}`) })}
          </Text>
        </div>
        {appeal ? (
          <Badge tone={appeal.status === 'overturned' ? 'success' : 'neutral'}>
            {reference(`appealStatuses.${appeal.status}`)}
          </Badge>
        ) : null}
      </div>
      <dl className="grid gap-3 text-sm">
        {decision.reason ? (
          <div className="grid gap-0.5">
            <dt className="font-medium">{t('reason')}</dt>
            <dd>{reference(`reportReasons.${decision.reason}`)}</dd>
          </div>
        ) : null}
        <div className="grid gap-0.5">
          <dt className="font-medium">{t('facts')}</dt>
          <dd className="whitespace-pre-line">{decision.statement}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="font-medium">{t('ground')}</dt>
          <dd>
            {decision.groundReference
              ? t('groundWithReference', {
                  ground: reference(`moderationGrounds.${decision.ground}`),
                  reference: decision.groundReference,
                })
              : reference(`moderationGrounds.${decision.ground}`)}
          </dd>
        </div>
      </dl>
      {decision.suspensionEndsAt ? (
        <Text size="sm">{t('suspensionEnds', { date: date(decision.suspensionEndsAt) })}</Text>
      ) : null}
      <Text size="sm" tone="muted">
        {decision.automatedDetection ? t('automated') : t('human')}
      </Text>
      {appeal ? (
        <AppealOutcome appeal={appeal} date={date} />
      ) : appealable && decision.appealableUntil ? (
        writing ? (
          <AppealForm
            decisionId={decision.id}
            onSent={(sent) => {
              setAppeal(sent);
              setWriting(false);
            }}
            onCancel={() => setWriting(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => setWriting(true)}>
              {t('appealAction')}
            </Button>
            <Text size="sm" tone="muted">
              {t('appealUntil', { date: date(decision.appealableUntil) })}
            </Text>
          </div>
        )
      ) : decision.appealableUntil ? (
        <Text size="sm" tone="muted">
          {t('notAppealable')}
        </Text>
      ) : null}
    </Card>
  );
}

function AppealOutcome({ appeal, date }: { appeal: Appeal; date: (iso: string) => string }) {
  const t = useTranslations('web.trust.moderation');
  return (
    <div className="grid gap-3 rounded-lg bg-surface-sunken p-4 text-sm">
      <div className="grid gap-0.5">
        <p className="font-medium">{t('appealYours', { date: date(appeal.createdAt) })}</p>
        <p className="whitespace-pre-line">{appeal.statement}</p>
      </div>
      {appeal.resolvedAt && appeal.outcomeStatement ? (
        <div className="grid gap-0.5">
          <p className="font-medium">{t('appealOutcome', { date: date(appeal.resolvedAt) })}</p>
          <p className="whitespace-pre-line">{appeal.outcomeStatement}</p>
        </div>
      ) : null}
    </div>
  );
}

function AppealForm({
  decisionId,
  onSent,
  onCancel,
}: {
  decisionId: string;
  onSent: (appeal: Appeal) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('web.trust.moderation');
  const announce = useAnnounce();
  const form = useZodForm(appealSchema, { defaultValues: { statement: '' } });
  const applyProblem = useApplyProblem(form);
  async function submit(values: { statement: string }) {
    try {
      const appeal = await standingControllerAppeal(decisionId, { statement: values.statement });
      announce(t('appealSent'));
      onSent(appeal);
    } catch (error) {
      applyProblem(error);
    }
  }
  return (
    <Form form={form} onSubmit={submit} aria-label={t('appealTitle')}>
      <Text size="sm">{t('appealDescription')}</Text>
      <FormField
        control={form.control}
        name="statement"
        label={t('appealStatement')}
        maxLength={TRUST_LIMITS.appealStatement}
        render={({ field }) => <Textarea {...field} rows={6} />}
      />
      <FormActions>
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          loadingLabel={t('appealSending')}
        >
          {t('appealSubmit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('appealCancel')}
        </Button>
      </FormActions>
    </Form>
  );
}

function ReportsSection({
  initial,
  date,
}: {
  initial: CursorPage<Report>;
  date: (iso: string) => string;
}) {
  const t = useTranslations('web.trust.moderation');
  const reference = useTranslations('reference');
  const [page, setPage] = useState(initial);
  const [loading, setLoading] = useState(false);
  const more = (cursor: string) => {
    setLoading(true);
    reportsControllerMine({ cursor, limit: 20 })
      .then((next) =>
        setPage((current) => ({
          items: [...current.items, ...next.items],
          nextCursor: next.nextCursor,
        })),
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  return (
    <section id="reports" aria-labelledby="reports-title" className="grid scroll-mt-24 gap-4">
      <Heading level={3} size="card" id="reports-title">
        {t('reportsTitle')}
      </Heading>
      {page.items.length === 0 ? (
        <Text size="sm" tone="muted">
          {t('reportsEmpty')}
        </Text>
      ) : (
        <ul className="grid divide-y divide-border rounded-xl border border-border bg-surface">
          {page.items.map((report) => (
            <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">
                  {reference(`reportTargetTypes.${report.targetType}`)} ·{' '}
                  {reference(`reportReasons.${report.reason}`)}
                </p>
                <Text size="sm" tone="muted">
                  {t('reportOn', { date: date(report.createdAt) })}
                </Text>
              </div>
              <Badge tone={report.status === 'resolved' ? 'neutral' : 'info'}>
                {report.outcome
                  ? reference(`reportOutcomes.${report.outcome}`)
                  : reference(`reportStatuses.${report.status}`)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {page.nextCursor ? (
        <Pagination
          hasMore
          loading={loading}
          onLoadMore={() => page.nextCursor && more(page.nextCursor)}
          shown={page.items.length}
        />
      ) : null}
    </section>
  );
}
