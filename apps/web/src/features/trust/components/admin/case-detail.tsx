'use client';

import { moderationControllerAssign } from '@pitchorium/api-client';
import type { ModerationCaseDetail, ModerationPerson } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Field,
  Heading,
  Select,
  Text,
  Timeline,
  useAnnounce,
} from '@/components/ui';
import { useConsoleAction, useConsoleProblem } from '@/features/admin';
import { useRouter } from '@/i18n/navigation';
import { DecisionStatement } from '../decision-statement';
import { CaseTarget } from './case-target';
import { DecisionForm } from './decision-form';

const NOBODY = '__nobody__';

/**
 * A case of the moderation (§13): what was reported and its limited context, the grouped
 * reports and their reasons, who handles it and the history of the assignments, the decisions
 * already taken with their statement and appeal, then the decision form while it is open. Its
 * reading is audited by the api.
 */
export function CaseDetail({
  detail,
  readerId,
  moderators,
}: {
  detail: ModerationCaseDetail;
  readerId: string;
  moderators: readonly ModerationPerson[];
}) {
  const t = useTranslations('web.admin.moderation.case');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const people = new Map<string, ModerationPerson>(
    [...detail.people, ...moderators].map((person) => [person.userId, person]),
  );
  const nameOf = (id: string | null) =>
    id ? (people.get(id)?.name ?? common('deletedMember')) : null;
  const messageContext =
    detail.reports.find((report) => report.messageContext)?.messageContext ?? null;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        <CaseTarget target={detail.target} messageContext={messageContext} people={people} />
        <Card className="grid gap-3 p-5" aria-labelledby="reports-title">
          <Heading level={2} size="card" id="reports-title">
            {t('reports', { count: detail.reports.length })}
          </Heading>
          {detail.origin === 'signal' ? (
            <Text size="sm">{t('fromSignal', { kind: detail.signalKind ?? '' })}</Text>
          ) : null}
          {detail.origin === 'staff' ? <Text size="sm">{t('fromStaff')}</Text> : null}
          <ul className="grid gap-2">
            {detail.reports.map((report) => (
              <li
                key={report.id}
                className="grid gap-1 rounded-md border border-border p-3 text-sm"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    tone={
                      report.reason === 'illegal_content' || report.reason === 'fraud'
                        ? 'danger'
                        : 'neutral'
                    }
                  >
                    {reference(`reportReasons.${report.reason}`)}
                  </Badge>
                  <span className="font-numeric text-muted tabular-nums">
                    {date(report.createdAt)}
                  </span>
                </span>
                <span className="text-muted">
                  {report.anonymous
                    ? t('anonymous')
                    : t('by', { name: nameOf(report.reporterId) ?? '' })}
                </span>
                {report.details ? (
                  <span className="whitespace-pre-line">{report.details}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
        {detail.decisions.length > 0 ? (
          <section aria-labelledby="history-title" className="grid gap-3">
            <Heading level={2} size="card" id="history-title">
              {t('decisions')}
            </Heading>
            {detail.decisions.map((decision) => (
              <Card key={decision.id} className="grid gap-3 p-5">
                <DecisionStatement
                  decision={decision}
                  date={(iso) => format.dateTime(new Date(iso), { dateStyle: 'long' })}
                  titleId={`decision-${decision.id}`}
                  headingLevel={3}
                  badge={
                    decision.appeal ? (
                      <Badge tone={decision.appeal.status === 'overturned' ? 'success' : 'neutral'}>
                        {reference(`appealStatuses.${decision.appeal.status}`)}
                      </Badge>
                    ) : null
                  }
                />
                <Text size="sm" tone="muted">
                  {t('decidedBy', { name: nameOf(decision.decidedBy) ?? '' })}
                </Text>
                {decision.appeal ? (
                  <div className="grid gap-1 rounded-md bg-surface-sunken p-3 text-sm">
                    <span className="font-medium">{t('appeal')}</span>
                    <span className="whitespace-pre-line">{decision.appeal.statement}</span>
                    {decision.appeal.outcomeStatement ? (
                      <span className="whitespace-pre-line text-muted">
                        {t('appealOutcome', { name: nameOf(decision.appealReviewerId) ?? '' })}{' '}
                        {decision.appeal.outcomeStatement}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            ))}
          </section>
        ) : null}
        {detail.status === 'open' ? (
          <DecisionForm
            caseId={detail.id}
            targetType={detail.targetType}
            reasons={detail.reasons}
            options={detail.decisionOptions}
          />
        ) : null}
      </div>
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="summary-title">
          <Heading level={2} size="card" id="summary-title">
            {t('summary')}
          </Heading>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('statusLabel')}</dt>
              <dd>{detail.status === 'open' ? t('open') : t('resolved')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('subject')}</dt>
              <dd>{detail.subject?.name ?? common('deletedMember')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('priority')}</dt>
              <dd className="font-numeric tabular-nums">{format.number(detail.priority)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{t('opened')}</dt>
              <dd className="font-numeric tabular-nums">{date(detail.createdAt)}</dd>
            </div>
          </dl>
        </Card>
        <Assignment detail={detail} readerId={readerId} moderators={moderators} nameOf={nameOf} />
      </div>
    </div>
  );
}

function Assignment({
  detail,
  readerId,
  moderators,
  nameOf,
}: {
  detail: ModerationCaseDetail;
  readerId: string;
  moderators: readonly ModerationPerson[];
  nameOf: (id: string | null) => string | null;
}) {
  const t = useTranslations('web.admin.moderation.case');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const assign = useConsoleAction('trust.moderation.assign');
  const [choice, setChoice] = useState(detail.assignedTo ?? NOBODY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(moderatorId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await moderationControllerAssign(detail.id, { moderatorId });
      announce(
        moderatorId ? t('assigned', { name: nameOf(moderatorId) ?? '' }) : t('unassignedDone'),
      );
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-3 p-5" aria-labelledby="assignment-title">
      <Heading level={2} size="card" id="assignment-title">
        {t('assignment')}
      </Heading>
      <Text size="sm">
        {detail.assignedTo
          ? t('assignedTo', { name: nameOf(detail.assignedTo) ?? '' })
          : t('nobody')}
      </Text>
      {assign.visible && detail.status === 'open' ? (
        <div className="grid gap-2">
          <Field label={t('assignTo')}>
            <Select
              value={choice}
              onValueChange={setChoice}
              options={[
                { value: NOBODY, label: t('nobodyOption') },
                ...moderators.map((person) => ({ value: person.userId, label: person.name })),
              ]}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              loadingLabel={t('assigning')}
              disabledReason={assign.disabledReason}
              onClick={() => void save(choice === NOBODY ? null : choice)}
            >
              {t('assign')}
            </Button>
            {detail.assignedTo !== readerId ? (
              <Button
                size="sm"
                variant="ghost"
                disabledReason={assign.disabledReason}
                onClick={() => void save(readerId)}
              >
                {t('assignMe')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {detail.assignments.length > 0 ? (
        <Timeline
          entries={detail.assignments.map((entry, index) => ({
            id: `${entry.assignedAt}-${index}`,
            title: entry.moderatorId
              ? t('historyAssigned', { name: nameOf(entry.moderatorId) ?? '' })
              : t('historyUnassigned'),
            when: format.dateTime(new Date(entry.assignedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            body: t('historyBy', { name: nameOf(entry.assignedBy) ?? '' }),
          }))}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
