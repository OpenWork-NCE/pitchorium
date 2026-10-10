'use client';

import type { ImpactAssessment, ImpactMethodology } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, Button, Field, FormActions, Notice, RadioGroup, Text } from '@/components/ui';
import { labelOf, type ReferenceLabels } from '../lib/labels';

/**
 * Self-declared assessment of a subject (§12, ADR 0036): every criterion of the methodology in
 * force answered by a level of its scale, its description beside it, prefilled when the api
 * gives answers still valid. The score is computed by the api and shown with its version and the
 * mention that it is not a certification.
 */
export function AssessmentForm({
  methodology,
  initialAnswers,
  current,
  onSubmit,
  submitLabel,
  problem,
}: {
  methodology: ImpactMethodology;
  /** Answers prefilled (the facet of the holder for a project, the last assessment otherwise). */
  initialAnswers: Record<string, string>;
  /** The assessment in force, its score shown above the form. */
  current: ImpactAssessment | null;
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  submitLabel: string;
  /** Translated refusal of the api, under the form. */
  problem?: string | null;
}) {
  const t = useTranslations('web.impact.form');
  const levels = useTranslations('reference.impactLevels');
  const reference = useTranslations('reference') as unknown as ReferenceLabels;
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function submit() {
    const unanswered = methodology.criteria
      .filter((criterion) => !answers[criterion.key])
      .map((criterion) => criterion.key);
    setMissing(unanswered);
    if (unanswered.length > 0) return;
    setBusy(true);
    try {
      await onSubmit(answers);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Text size="sm" tone="muted">
          {t('methodology', { name: methodology.name, version: methodology.version })}
        </Text>
        {methodology.demo ? <Alert tone="warning">{reference('impactMentions.demo')}</Alert> : null}
        {current ? (
          <p className="text-sm font-medium" data-testid="impact-score">
            {t('current', {
              score: current.score,
              level: levels(current.level),
              version: current.methodology.version,
            })}
          </p>
        ) : null}
        {current?.reassessmentSuggested ? (
          <Alert tone="info">{t('reassess', { version: methodology.version })}</Alert>
        ) : null}
      </div>
      <form
        className="grid gap-6"
        aria-label={t('label')}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {methodology.criteria.map((criterion) => (
          <Field
            key={criterion.key}
            label={labelOf(reference, criterion.labelKey)}
            description={labelOf(reference, criterion.descriptionKey)}
            error={missing.includes(criterion.key) ? t('required') : undefined}
          >
            <RadioGroup
              value={answers[criterion.key]}
              onValueChange={(value) =>
                setAnswers((current) => ({ ...current, [criterion.key]: value }))
              }
              options={criterion.scale.map((level) => ({
                value: level.key,
                label: labelOf(reference, level.labelKey),
              }))}
            />
          </Field>
        ))}
        <Notice kind="selfDeclared" version={`v${methodology.version}`} />
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <FormActions>
          <Button type="submit" loading={busy} loadingLabel={t('saving')}>
            {submitLabel}
          </Button>
        </FormActions>
      </form>
    </div>
  );
}
