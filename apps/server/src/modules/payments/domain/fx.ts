import type { FxRateSource } from '@pitchorium/contracts';
import { DomainError, minorUnitsPerMajor, Money } from '../../../platform/kernel';

/** Projects are labelled in euros (ADR 0037): every contribution has its EUR equivalent. */
export const EUR = 'EUR';

/**
 * Fixed legal parities of the CFA francs (ADR 0046): 655.957 francs for one euro, for the
 * West African (XOF) and Central African (XAF) francs.
 */
export const FIXED_PARITIES: Readonly<Record<string, string>> = {
  XOF: '655.957',
  XAF: '655.957',
};

/** Units of a currency for one euro, as a decimal string, with its source and date. */
export interface Rate {
  unitsPerEur: string;
  source: FxRateSource;
  at: Date;
}

const DECIMAL = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

/** A positive decimal string as an exact fraction numerator / denominator. */
export function parseRate(unitsPerEur: string): { numerator: bigint; denominator: bigint } {
  const match = DECIMAL.exec(unitsPerEur);
  if (!match) throw new DomainError('VALIDATION_FAILED', `Invalid rate: ${unitsPerEur}`);
  const fraction = match[2] ?? '';
  const numerator = BigInt(`${match[1]}${fraction}`);
  if (numerator === 0n) throw new DomainError('VALIDATION_FAILED', 'A rate is positive');
  return { numerator, denominator: 10n ** BigInt(fraction.length) };
}

/** Rate known without any provider: the euro itself and the fixed parities. */
export function fixedRate(currency: string, at: Date): Rate | null {
  if (currency === EUR) return { unitsPerEur: '1', source: 'identity', at };
  const parity = FIXED_PARITIES[currency];
  return parity ? { unitsPerEur: parity, source: 'fixed_parity', at } : null;
}

/** Rounds numerator / denominator (both positive) to the nearest integer, halves up. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * EUR equivalent of an amount, in exact integer arithmetic, rounded to the nearest cent with
 * halves up (ADR 0046): 65 596 XOF give 100.00 EUR (65 596 / 655.957 = 100.0005...).
 */
export function eurEquivalent(amount: Money, rate: Rate): Money {
  if (amount.currency === EUR) return amount;
  const { numerator, denominator } = parseRate(rate.unitsPerEur);
  const sign = amount.amountMinor < 0n ? -1n : 1n;
  const absolute = amount.amountMinor * sign;
  // EUR cents = minor * 100 / units per major / units per EUR.
  const cents = roundHalfUp(
    absolute * minorUnitsPerMajor(EUR) * denominator,
    minorUnitsPerMajor(amount.currency) * numerator,
  );
  return Money.of(cents * sign, EUR);
}

/**
 * Smallest amount of a currency whose EUR equivalent reaches the given euros: the bounds and
 * the reward minimums shown in the paid currency.
 */
export function smallestAmountReaching(eur: Money, currency: string, rate: Rate): Money {
  if (currency === EUR) return eur;
  const { numerator, denominator } = parseRate(rate.unitsPerEur);
  const estimate =
    (eur.amountMinor * minorUnitsPerMajor(currency) * numerator) /
    (minorUnitsPerMajor(EUR) * denominator);
  // The rounding of eurEquivalent may reach the target a few units below the exact quotient.
  let candidate = estimate > 0n ? estimate - 1n : 0n;
  while (eurEquivalent(Money.of(candidate, currency), rate).amountMinor < eur.amountMinor) {
    candidate += 1n;
  }
  while (
    candidate > 0n &&
    eurEquivalent(Money.of(candidate - 1n, currency), rate).amountMinor >= eur.amountMinor
  ) {
    candidate -= 1n;
  }
  return Money.of(candidate, currency);
}
