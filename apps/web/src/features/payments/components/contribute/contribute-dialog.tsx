'use client';

import {
  contributionsControllerOne,
  getContributionsControllerOneQueryKey,
  getOrganizationsControllerMineQueryKey,
  organizationsControllerMine,
} from '@pitchorium/api-client';
import type { Contribution, MyOrganization, PaymentOptions } from '@pitchorium/contracts';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogContent, Loading, Skeleton } from '@/components/ui';
import { useCurrentMember } from '@/features/identity';
import { type JourneyKind, type JourneyStep, neighbourStep } from '../../lib/journey';
import type { ContributeProject } from './contribute-entry';
import {
  AmountStep,
  BehalfStep,
  CountryStep,
  DisplayStep,
  KindStep,
  MethodStep,
  RewardStep,
} from './journey-steps';
import { CommitmentStep, ReviewStep } from './review-step';
import { firstIncompleteStep, type JourneyChoices, useJourney, visibleStep } from './use-journey';
import { usePaymentOptions } from './use-payment-options';
import { useQuote } from './use-quote';

/** Roles that may contribute in the name of an organisation (payments README). */
const CONTRIBUTING_ROLES = new Set(['owner', 'admin']);

/** The choices of a contribution kept by the api, for a new attempt that loses nothing. */
function choicesOf(contribution: Contribution): Partial<JourneyChoices> {
  return {
    kind: contribution.kind,
    currency: contribution.amount.currency,
    amountMinor: contribution.amount.amountMinor,
    rewardId: contribution.rewardId,
    organizationId: contribution.organizationId,
    publicDisplay: contribution.publicDisplay,
    anonymous: contribution.anonymous,
    method: contribution.method,
  };
}

/**
 * The journey of a contribution (§9.3, ADR 0136): a dialog on a computer, the whole screen on a
 * phone, one step per screen and per address (`?contribute=<step>`, the back button of the
 * browser goes to the previous step). It opens once the organisations of the member (the step
 * « au nom de ») and, for a new attempt after a failure (`?from=<contribution>`), the choices the
 * api kept are read: no step appears late, and the address of the step asked is kept.
 */
export default function ContributeDialog(props: {
  project: ContributeProject;
  options: PaymentOptions;
  step: string;
  retryOf: string | null;
  onStep: (step: JourneyStep) => void;
  onClose: () => void;
}) {
  const t = useTranslations('web.payments.journey');
  const organizations = useQuery({
    queryKey: getOrganizationsControllerMineQueryKey(),
    queryFn: ({ signal }) => organizationsControllerMine({ signal }),
    staleTime: 60_000,
  });
  const retry = useQuery({
    queryKey: getContributionsControllerOneQueryKey(props.retryOf ?? ''),
    queryFn: ({ signal }) => contributionsControllerOne(props.retryOf!, { signal }),
    enabled: props.retryOf !== null,
  });
  if (organizations.isPending || (props.retryOf !== null && retry.isPending)) {
    return (
      <Dialog open onOpenChange={(open) => (open ? undefined : props.onClose())}>
        <DialogContent
          size="lg"
          title={t('title', { title: props.project.title })}
          className="max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none"
          data-testid="contribute-dialog"
        >
          <Loading label={t('loading')}>
            <Skeleton className="h-40 w-full" />
          </Loading>
        </DialogContent>
      </Dialog>
    );
  }
  const contributing = (organizations.data?.items ?? []).filter((entry) =>
    CONTRIBUTING_ROLES.has(entry.role),
  );
  return (
    <Journey
      {...props}
      organizations={contributing}
      initial={{
        country: props.options.contributorCountry,
        currency: props.options.currencies[0]?.currency ?? null,
        ...(retry.data ? choicesOf(retry.data) : {}),
      }}
    />
  );
}

/** The steps of the journey; its choices live in this dialog only. */
function Journey({
  project,
  options: initialOptions,
  step: rawStep,
  onStep,
  onClose,
  organizations: contributing,
  initial,
}: {
  project: ContributeProject;
  options: PaymentOptions;
  step: string;
  onStep: (step: JourneyStep) => void;
  onClose: () => void;
  organizations: MyOrganization[];
  initial: Partial<JourneyChoices>;
}) {
  const t = useTranslations('web.payments.journey');
  const member = useCurrentMember();
  const [, setInterest] = useQueryState('interest', parseAsString);
  const hasRewards = useCallback(
    (kind: JourneyKind | null) =>
      kind === 'reward_crowdfunding' &&
      project.rewards.some((reward) => (reward.instruments as string[]).includes(kind)),
    [project.rewards],
  );
  const context = useMemo(
    () => ({ hasRewards, hasOrganizations: contributing.length > 0 }),
    [hasRewards, contributing.length],
  );
  const { choices, steps, update } = useJourney(initial, context);

  // Read again when the country, the currency or the amount change (debounced).
  const live = usePaymentOptions(project.id, {
    country: choices.country ?? undefined,
    currency: choices.currency ?? undefined,
    amountMinor: choices.amountMinor ?? undefined,
  });
  const options = live.data ?? initialOptions;
  // A currency the api no longer offers for this country gives way to the first one it offers.
  useEffect(() => {
    if (options.currencies.length === 0) return;
    if (!options.currencies.some((entry) => entry.currency === choices.currency)) {
      update({ currency: options.currencies[0]!.currency, amountMinor: null });
    }
  }, [options.currencies, choices.currency, update]);

  const step = visibleStep(rawStep, steps, choices);
  // The reward chosen: the quote of the api says whether the amount reaches its minimum.
  const rewardQuote = useQuote(
    project.id,
    {
      kind: choices.kind === 'love_money_commitment' ? null : choices.kind,
      currency: choices.currency,
      amountMinor: choices.amountMinor,
      rewardId: choices.rewardId,
      country: choices.country,
    },
    step === 'reward' && choices.rewardId !== null,
  );
  const rewardRefused =
    step === 'reward' &&
    choices.rewardId !== null &&
    (rewardQuote.data?.reward?.rewardId !== choices.rewardId || !rewardQuote.data.reward.eligible);
  useEffect(() => {
    if (step !== rawStep) onStep(step);
  }, [step, rawStep, onStep]);
  const index = steps.indexOf(step);
  const previous = neighbourStep(steps, step, -1);
  const next = neighbourStep(steps, step, 1);
  const blocked = (() => {
    const missing = firstIncompleteStep(steps.slice(0, index + 1), choices);
    return missing === step;
  })();
  const [declared, setDeclared] = useState(false);

  function openInterest() {
    onClose();
    void setInterest('1');
  }

  let body;
  if (step === 'kind') {
    body = (
      <KindStep
        choices={choices}
        update={update}
        options={options}
        instruments={project.instruments}
        onInterest={openInterest}
      />
    );
  } else if (step === 'country') {
    body = <CountryStep choices={choices} update={update} />;
  } else if (step === 'amount') {
    body = (
      <AmountStep choices={choices} update={update} options={options} projectId={project.id} />
    );
  } else if (step === 'reward') {
    body = (
      <RewardStep
        choices={choices}
        update={update}
        rewards={project.rewards}
        quote={rewardQuote.data}
      />
    );
  } else if (step === 'behalf') {
    body = (
      <BehalfStep
        choices={choices}
        update={update}
        organizations={contributing}
        ownName={member.profile.displayName}
      />
    );
  } else if (step === 'display') {
    body = (
      <DisplayStep
        choices={choices}
        update={update}
        anonymousAllowed={options.anonymousDonations && choices.kind === 'donation'}
      />
    );
  } else if (step === 'method') {
    body = (
      <MethodStep choices={choices} update={update} options={options} loading={live.isFetching} />
    );
  } else if (choices.kind === 'love_money_commitment') {
    body = (
      <CommitmentStep
        projectId={project.id}
        onDeclared={() => setDeclared(true)}
        onDone={onClose}
      />
    );
  } else {
    body = <ReviewStep projectId={project.id} choices={choices} onStep={onStep} />;
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        size="lg"
        title={t('title', { title: project.title })}
        description={t('progress', {
          current: index + 1,
          total: steps.length,
          step: t(`steps.${step}`),
        })}
        className="max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none"
        data-testid="contribute-dialog"
        data-step={step}
      >
        <div className="grid gap-6">
          {body}
          {step === 'review' ? (
            previous && !declared ? (
              <Button
                type="button"
                variant="ghost"
                className="justify-self-start"
                onClick={() => onStep(previous)}
              >
                {t('back')}
              </Button>
            ) : null
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              {previous ? (
                <Button type="button" variant="ghost" onClick={() => onStep(previous)}>
                  {t('back')}
                </Button>
              ) : (
                <span />
              )}
              {next ? (
                <Button
                  type="button"
                  disabledReason={
                    blocked
                      ? t(`required.${step as 'kind' | 'country' | 'amount' | 'method'}`)
                      : rewardRefused
                        ? t('required.reward')
                        : undefined
                  }
                  onClick={() => onStep(next)}
                >
                  {t('next')}
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
