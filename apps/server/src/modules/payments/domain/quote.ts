import type { ContributionKind, RewardInstrument } from '@pitchorium/contracts';
import { DomainError, Money } from '../../../platform/kernel';
import { type CommissionTerms, commissionOn } from './commission';
import { eurEquivalent, type Rate } from './fx';

export interface RewardTerms {
  id: string;
  /** In EUR (ADR 0037). */
  minAmount: Money;
  instruments: readonly RewardInstrument[];
  /** Units left, null when unlimited. */
  available: number | null;
}

export interface Quote {
  kind: ContributionKind;
  amount: Money;
  eurEquivalent: Money;
  rate: Rate;
  commission: Money;
  terms: CommissionTerms;
  estimatedProviderFee: Money | null;
  estimatedHolderAmount: Money | null;
  reward: { rewardId: string; minAmount: Money; eligible: boolean; soldOut: boolean } | null;
}

/**
 * A reward is obtained with an instrument it lists (love money has none, section 11.3), when the
 * EUR equivalent reaches its minimum and a unit is left.
 */
export function rewardEligible(kind: ContributionKind, eur: Money, reward: RewardTerms): boolean {
  return (
    (reward.instruments as readonly string[]).includes(kind) &&
    eur.compare(reward.minAmount) >= 0 &&
    reward.available !== 0
  );
}

/**
 * Section 9.3 step 7: amount, EUR equivalent, commission, estimated fees and estimated amount
 * for the holder, before paying. The fees of the provider are borne by the holder.
 */
export function buildQuote(input: {
  kind: ContributionKind;
  amount: Money;
  rate: Rate;
  terms: CommissionTerms;
  estimatedFee: Money | null;
  reward: RewardTerms | null;
}): Quote {
  const eur = eurEquivalent(input.amount, input.rate);
  const commission = commissionOn(input.amount, input.terms);
  const holder = input.estimatedFee
    ? input.amount.subtract(commission).subtract(input.estimatedFee)
    : null;
  return {
    kind: input.kind,
    amount: input.amount,
    eurEquivalent: eur,
    rate: input.rate,
    commission,
    terms: input.terms,
    estimatedProviderFee: input.estimatedFee,
    estimatedHolderAmount: holder && holder.isNegative() ? Money.zero(holder.currency) : holder,
    reward: input.reward
      ? {
          rewardId: input.reward.id,
          minAmount: input.reward.minAmount,
          eligible: rewardEligible(input.kind, eur, input.reward),
          soldOut: input.reward.available === 0,
        }
      : null,
  };
}

export interface AmountBounds {
  /** Platform bounds of a contribution, on its EUR equivalent. */
  minEur: Money;
  maxEur: Money;
  /** Bounds of the provider in the paid currency, null when not documented. */
  providerMinMinor: bigint | null;
  providerMaxMinor: bigint | null;
}

export function assertWithinBounds(quote: Quote, bounds: AmountBounds): void {
  const amount = quote.amount.amountMinor;
  const outside =
    quote.eurEquivalent.compare(bounds.minEur) < 0 ||
    quote.eurEquivalent.compare(bounds.maxEur) > 0 ||
    (bounds.providerMinMinor !== null && amount < bounds.providerMinMinor) ||
    (bounds.providerMaxMinor !== null && amount > bounds.providerMaxMinor);
  if (outside) {
    throw new DomainError('PAYMENTS_AMOUNT_OUT_OF_RANGE', 'Amount out of the allowed range');
  }
}
