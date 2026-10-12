'use client';

import type { ModerationDecision } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Heading, Text } from '@/components/ui';

/**
 * The statement of reasons of a decision as the member concerned reads it (§13, ADR 0072): the
 * decision, its date and target, the reason, the facts, the ground and its reference, the end of
 * a suspension and whether a human decided after an automatic signal. The page of the member and
 * the preview of the console show the same block.
 */
export function DecisionStatement({
  decision,
  date,
  titleId,
  badge,
  headingLevel = 4,
}: {
  decision: Pick<
    ModerationDecision,
    | 'kind'
    | 'targetType'
    | 'reason'
    | 'statement'
    | 'ground'
    | 'groundReference'
    | 'suspensionEndsAt'
    | 'automatedDetection'
    | 'decidedAt'
  >;
  date: (iso: string) => string;
  titleId: string;
  /** Next to the title: the state of the appeal. */
  badge?: ReactNode;
  headingLevel?: 2 | 3 | 4;
}) {
  const t = useTranslations('web.trust.moderation');
  const reference = useTranslations('reference');
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <Heading level={headingLevel} size="card" id={titleId} className="scroll-mt-24">
            {reference(`moderationDecisionKinds.${decision.kind}`)}
          </Heading>
          <Text size="sm" tone="muted">
            {t('decidedOn', { date: date(decision.decidedAt) })} ·{' '}
            <span className="whitespace-nowrap">
              {t('concerns', { target: reference(`reportTargetTypes.${decision.targetType}`) })}
            </span>
          </Text>
        </div>
        {badge}
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
    </>
  );
}
