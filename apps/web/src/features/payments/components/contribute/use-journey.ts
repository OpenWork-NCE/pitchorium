'use client';

import type { PaymentMethod } from '@pitchorium/contracts';
import { useCallback, useMemo, useState } from 'react';
import { currentStep, type JourneyKind, type JourneyStep, journeySteps } from '../../lib/journey';

/**
 * The choices of the contributor, kept in the memory of the dialog only: no state of a payment
 * goes to the storage of the browser (ADR 0136). A new attempt after a failure reads them again
 * from the contribution the api kept.
 */
export interface JourneyChoices {
  kind: JourneyKind | null;
  country: string | null;
  currency: string | null;
  amountMinor: string | null;
  rewardId: string | null;
  /** Null: in their own name. */
  organizationId: string | null;
  publicDisplay: boolean;
  anonymous: boolean;
  method: PaymentMethod | null;
}

export const EMPTY_CHOICES: JourneyChoices = {
  kind: null,
  country: null,
  currency: null,
  amountMinor: null,
  rewardId: null,
  organizationId: null,
  publicDisplay: false,
  anonymous: false,
  method: null,
};

/** The first step whose choice is still missing, null when every step before review is done. */
export function firstIncompleteStep(
  steps: readonly JourneyStep[],
  choices: JourneyChoices,
): JourneyStep | null {
  for (const step of steps) {
    if (step === 'kind' && !choices.kind) return step;
    if (step === 'country' && !choices.country) return step;
    if (step === 'amount' && (!choices.amountMinor || !choices.currency)) return step;
    if (step === 'method' && !choices.method) return step;
  }
  return null;
}

/**
 * The step to show: the one of the address when every choice before it is made, otherwise the
 * first step still to answer (a page reloaded in the middle of the journey starts again where a
 * choice is missing, not on an empty review).
 */
export function visibleStep(
  raw: string | null,
  steps: readonly JourneyStep[],
  choices: JourneyChoices,
): JourneyStep {
  const asked = currentStep(raw, steps);
  const missing = firstIncompleteStep(steps, choices);
  if (missing && steps.indexOf(missing) < steps.indexOf(asked)) return missing;
  return asked;
}

export function useJourney(
  initial: Partial<JourneyChoices>,
  context: { hasRewards: (kind: JourneyKind | null) => boolean; hasOrganizations: boolean },
) {
  const [choices, setChoices] = useState<JourneyChoices>({ ...EMPTY_CHOICES, ...initial });
  const steps = useMemo(
    () =>
      journeySteps({
        kind: choices.kind,
        hasRewards: context.hasRewards(choices.kind),
        hasOrganizations: context.hasOrganizations,
      }),
    [choices.kind, context],
  );
  const update = useCallback((patch: Partial<JourneyChoices>) => {
    setChoices((previous) => {
      const next = { ...previous, ...patch };
      // Another kind or currency changes what the reward and the method can be.
      if (patch.kind !== undefined && patch.kind !== previous.kind) {
        next.rewardId = null;
        next.anonymous = false;
      }
      if (patch.currency !== undefined && patch.currency !== previous.currency) next.method = null;
      if (patch.country !== undefined && patch.country !== previous.country) next.method = null;
      return next;
    });
  }, []);
  return { choices, steps, update };
}
