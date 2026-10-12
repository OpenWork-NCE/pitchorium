'use client';

import { methodologiesControllerPreview } from '@pitchorium/api-client';
import type { ImpactCriterion, ImpactScorePreview, Locale } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, Card, Field, Heading, Select, Text } from '@/components/ui';
import { useConsoleProblem } from '@/features/admin';
import { labelOf, type ReferenceLabels } from '../../lib/labels';

const LEVEL_TONES = { emerging: 'neutral', moderate: 'info', strong: 'success' } as const;

/**
 * The score some answers would give with a saved version, computed by the api by the rules of an
 * assessment (§12): the administrator checks the weights before publishing.
 */
export function ScorePreview({
  methodologyId,
  criteria,
  locale,
  reference,
  disabledReason,
}: {
  methodologyId: string;
  /** The criteria of the saved version. */
  criteria: readonly ImpactCriterion[];
  locale: Locale;
  reference: ReferenceLabels;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.impact.preview');
  const levels = useTranslations('reference.impactLevels');
  const problem = useConsoleProblem();
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(criteria.map((criterion) => [criterion.key, criterion.scale[0]?.key ?? ''])),
  );
  const [result, setResult] = useState<ImpactScorePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function compute() {
    setBusy(true);
    setError(null);
    try {
      setResult(await methodologiesControllerPreview(methodologyId, { answers }));
    } catch (failure) {
      setResult(null);
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="grid gap-4 p-5" aria-labelledby="preview-title">
      <Heading level={2} size="card" id="preview-title">
        {t('title')}
      </Heading>
      <Text size="sm" tone="muted">
        {t('hint')}
      </Text>
      <div className="grid gap-3">
        {criteria.map((criterion) => (
          <Field
            key={criterion.key}
            label={labelOf(reference, criterion.labelKey, criterion.labels, locale)}
          >
            <Select
              value={answers[criterion.key]}
              onValueChange={(value) => {
                setAnswers((current) => ({ ...current, [criterion.key]: value }));
                setResult(null);
              }}
              options={criterion.scale.map((level) => ({
                value: level.key,
                label: t('answer', {
                  label: labelOf(reference, level.labelKey, level.labels, locale),
                  value: level.value,
                }),
              }))}
            />
          </Field>
        ))}
      </div>
      <Button
        variant="secondary"
        className="justify-self-start"
        loading={busy}
        loadingLabel={t('computing')}
        disabledReason={disabledReason}
        onClick={() => void compute()}
      >
        {t('compute')}
      </Button>
      {result ? (
        <div className="grid gap-2 rounded-lg bg-surface-sunken p-4" aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-3">
            <span className="font-numeric text-3xl font-semibold tabular-nums">{result.score}</span>
            <span className="text-sm text-muted">{t('outOf')}</span>
            <Badge tone={LEVEL_TONES[result.level]}>{levels(result.level)}</Badge>
          </p>
          <ul className="grid gap-1 text-sm">
            {result.details.map((detail) => (
              <li key={detail.criterionKey} className="flex justify-between gap-3">
                <span>{labelOf(reference, detail.labelKey, detail.labels, locale)}</span>
                <span className="font-numeric text-muted tabular-nums">
                  {t('detail', {
                    value: detail.value,
                    max: detail.maxValue,
                    weight: detail.weight,
                  })}
                </span>
              </li>
            ))}
          </ul>
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
