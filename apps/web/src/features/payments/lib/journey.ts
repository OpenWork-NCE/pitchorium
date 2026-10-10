import type { ContributionKind } from '@pitchorium/contracts';

/**
 * What the contributor chooses at the first step (§9.1, §9.3): a collected kind, or a love money
 * commitment without any payment, declared off the platform (ADR 0049).
 */
export type JourneyKind = ContributionKind | 'love_money_commitment';

/** Steps of the journey, each with its address (`?contribute=<step>`, ADR 0136). */
export const JOURNEY_STEPS = [
  'kind',
  'country',
  'amount',
  'reward',
  'behalf',
  'display',
  'method',
  'review',
] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export interface JourneyContext {
  kind: JourneyKind | null;
  /** The project has a reward this kind may choose. */
  hasRewards: boolean;
  /** The member may contribute in the name of an organisation (`owner` or `admin`). */
  hasOrganizations: boolean;
}

/**
 * The steps for these choices, in order: a love money commitment is declared at once (no amount
 * nor payment); the reward only for a reward funding with rewards; the name of an organisation
 * only for a member who may use one.
 */
export function journeySteps({
  kind,
  hasRewards,
  hasOrganizations,
}: JourneyContext): JourneyStep[] {
  if (kind === 'love_money_commitment') return ['kind', 'review'];
  return JOURNEY_STEPS.filter((step) => {
    if (step === 'reward') return kind === 'reward_crowdfunding' && hasRewards;
    if (step === 'behalf') return hasOrganizations;
    return true;
  });
}

/** A step read from the address, kept only if it belongs to the journey; the first otherwise. */
export function currentStep(raw: string | null, steps: readonly JourneyStep[]): JourneyStep {
  return steps.find((step) => step === raw) ?? steps[0]!;
}

/** The step after or before this one, null at either end. */
export function neighbourStep(
  steps: readonly JourneyStep[],
  step: JourneyStep,
  direction: 1 | -1,
): JourneyStep | null {
  const index = steps.indexOf(step);
  return steps[index + direction] ?? null;
}
