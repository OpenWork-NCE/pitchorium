'use client';

import {
  ApiProblemError,
  projectsControllerReplaceTiers,
  projectsControllerUpdate,
} from '@pitchorium/api-client';
import { Lock, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Field,
  FundingProgress,
  Heading,
  IconButton,
  Input,
  MoneyInput,
  Text,
  Textarea,
} from '@/components/ui';
import { PROJECT_LIMITS } from '../../lib/limits';
import { lockedFields } from '../../lib/locked';
import { type TierDraft, tierIssues } from '../../lib/tiers';
import { useProjectEditor } from './editor-context';
import { useAutosave } from './use-autosave';

/** A lock explained next to its field (ADR 0039). */
function LockNote({ reason }: { reason: 'contribution' | 'published' }) {
  const t = useTranslations('web.projects.editor.locked');
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted">
      <Lock aria-hidden className="size-4" />
      {t(reason)}
    </p>
  );
}

/**
 * Step 4, « Financement » (§11.1, ADR 0038): the goal in euros, the duration of 30 to 90 days,
 * 1 to 5 cumulative tiers with the use of their funds, the last one being the goal, checked live
 * as the api checks them, with the progress of the campaign drawn as it will be shown. After the
 * first paid contribution, the amounts are locked and say why; the duration from the publication.
 */
export function StepFunding() {
  const t = useTranslations('web.projects.editor.funding');
  const errors = useTranslations('errors');
  const { project, setProject } = useProjectEditor();
  const locks = lockedFields(project.status, project.management?.fundingLocked ?? false);
  const [goal, setGoal] = useState<string | null>(project.funding.goal?.amountMinor ?? null);
  const [duration, setDuration] = useState<string>(
    project.management?.durationDays ? String(project.management.durationDays) : '',
  );
  const [tiers, setTiers] = useState<TierDraft[]>(
    project.tiers.length > 0
      ? project.tiers.map((tier) => ({
          thresholdMinor: tier.threshold.amountMinor,
          description: tier.description,
        }))
      : [{ thresholdMinor: null, description: '' }],
  );
  const [problem, setProblem] = useState<string | null>(null);
  // The last tier is the goal: its threshold follows it.
  const drafted = tiers.map((tier, index) =>
    index === tiers.length - 1 ? { ...tier, thresholdMinor: goal } : tier,
  );
  const issues = tierIssues(drafted, goal);
  const days = Number(duration);
  const durationValid =
    Number.isInteger(days) &&
    days >= PROJECT_LIMITS.durationMin &&
    days <= PROJECT_LIMITS.durationMax;

  const { schedule } = useAutosave(async () => {
    if (issues.list.length > 0 || issues.tiers.length > 0) return false;
    setProblem(null);
    try {
      if (!locks.goal || !locks.duration) {
        await projectsControllerUpdate(project.id, {
          ...(locks.goal ? {} : { goal: { amountMinor: goal!, currency: 'EUR' } }),
          ...(locks.duration || !durationValid ? {} : { durationDays: days }),
        });
      }
      setProject(
        await projectsControllerReplaceTiers(project.id, {
          tiers: drafted.map((tier) => ({
            threshold: { amountMinor: tier.thresholdMinor!, currency: 'EUR' },
            description: tier.description.trim(),
          })),
        }),
      );
      return true;
    } catch (error) {
      setProblem(
        error instanceof ApiProblemError ? errors(error.problem.code as never) : t('failed'),
      );
      throw error;
    }
  });
  const signature = JSON.stringify([goal, duration, tiers]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    schedule();
  }, [signature, schedule]);

  const issueOf = (index: number) =>
    issues.tiers
      .filter((issue) => issue.index === index)
      .map((issue) => t(`issues.${issue.issue}`));
  const setTier = (index: number, change: Partial<TierDraft>) =>
    setTiers((current) =>
      current.map((tier, at) => (at === index ? { ...tier, ...change } : tier)),
    );

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('goal')}
          description={t('goalHint')}
          error={issues.list.includes('goal_required') ? t('issues.goal_required') : undefined}
          disabled={locks.goal !== null}
        >
          <MoneyInput
            currency="EUR"
            value={goal}
            onChange={setGoal}
            disabled={locks.goal !== null}
          />
        </Field>
        <Field
          label={t('duration')}
          description={t('durationHint', {
            min: PROJECT_LIMITS.durationMin,
            max: PROJECT_LIMITS.durationMax,
          })}
          error={duration && !durationValid ? t('durationInvalid') : undefined}
          disabled={locks.duration !== null}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={PROJECT_LIMITS.durationMin}
            max={PROJECT_LIMITS.durationMax}
            value={duration}
            disabled={locks.duration !== null}
            onChange={(event) => setDuration(event.target.value)}
          />
        </Field>
      </div>
      {locks.goal ? <LockNote reason={locks.goal} /> : null}
      {locks.duration ? <LockNote reason={locks.duration} /> : null}
      <section aria-labelledby="tiers-step-title" className="grid gap-4">
        <div className="grid gap-1">
          <Heading level={2} size="card" id="tiers-step-title">
            {t('tiers')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('tiersHint', { max: PROJECT_LIMITS.tiersMax })}
          </Text>
        </div>
        <ol className="grid gap-4">
          {drafted.map((tier, index) => {
            const last = index === drafted.length - 1;
            const messages = issueOf(index);
            return (
              <li key={index} className="grid gap-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{t('tier', { position: index + 1 })}</p>
                  {drafted.length > 1 && !locks.tierThresholds ? (
                    <IconButton
                      type="button"
                      size="sm"
                      label={t('removeTier', { position: index + 1 })}
                      icon={<X />}
                      onClick={() => setTiers((current) => current.filter((_, at) => at !== index))}
                    />
                  ) : null}
                </div>
                <Field
                  label={t('threshold')}
                  description={last ? t('lastIsGoal') : t('thresholdHint')}
                  disabled={last || locks.tierThresholds !== null}
                >
                  <MoneyInput
                    currency="EUR"
                    value={tier.thresholdMinor}
                    disabled={last || locks.tierThresholds !== null}
                    onChange={(value) => setTier(index, { thresholdMinor: value })}
                  />
                </Field>
                <Field
                  label={t('use')}
                  counter={{ count: tier.description.length, max: PROJECT_LIMITS.tierDescription }}
                >
                  <Textarea
                    value={tier.description}
                    rows={2}
                    onChange={(event) => setTier(index, { description: event.target.value })}
                  />
                </Field>
                {messages.length > 0 ? (
                  <ul className="grid gap-1 text-sm text-danger" aria-live="polite">
                    {messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
        {locks.tierThresholds ? <LockNote reason={locks.tierThresholds} /> : null}
        {tiers.length < PROJECT_LIMITS.tiersMax && !locks.tierThresholds ? (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                // A new tier goes before the goal, which stays the last one.
                setTiers((current) => [
                  ...current.slice(0, -1),
                  { thresholdMinor: null, description: '' },
                  ...current.slice(-1),
                ])
              }
            >
              <Plus aria-hidden />
              {t('addTier')}
            </Button>
          </div>
        ) : null}
      </section>
      {problem ? (
        <Alert tone="danger" live="alert">
          {problem}
        </Alert>
      ) : null}
      {goal ? (
        <section aria-labelledby="funding-preview-title" className="grid gap-3">
          <Heading level={2} size="card" id="funding-preview-title">
            {t('preview')}
          </Heading>
          <div className="rounded-lg border border-border bg-surface p-4">
            <FundingProgress
              label={t('previewLabel')}
              raised={project.funding.collected}
              goal={{ amountMinor: goal, currency: 'EUR' }}
              daysLeft={null}
              remainingLabel={
                durationValid ? t('previewDuration', { days }) : t('previewNoDuration')
              }
              milestones={drafted
                // One marker per amount: two equal thresholds (refused) are drawn once.
                .filter(
                  (tier, index, all) =>
                    tier.thresholdMinor &&
                    all.findIndex((other) => other.thresholdMinor === tier.thresholdMinor) ===
                      index,
                )
                .map((tier) => ({ amountMinor: tier.thresholdMinor!, label: tier.description }))}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
