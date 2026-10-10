import type { MoneyDto } from '@pitchorium/contracts';

/** The CFA franc of the declared country of the member and its parity (ADR 0130). */
export interface FixedParity {
  currency: 'XOF' | 'XAF';
  /** Units of the currency for one euro, a decimal string (`655.957`). */
  unitsPerEur: string;
}

const DECIMAL = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

/**
 * Indicative equivalent of an amount in euros, in the CFA franc of the reader (ADR 0130): exact
 * integer arithmetic, rounded to the nearest franc, halves up; null for any other amount. The
 * franc has no minor unit: the result is in whole francs.
 */
export function indicativeEquivalent(amount: MoneyDto, parity: FixedParity): MoneyDto | null {
  if (amount.currency !== 'EUR') return null;
  const match = DECIMAL.exec(parity.unitsPerEur);
  if (!match) return null;
  const fraction = match[2] ?? '';
  const numerator = BigInt(`${match[1]}${fraction}`);
  const denominator = 10n ** BigInt(fraction.length);
  const cents = BigInt(amount.amountMinor);
  const sign = cents < 0n ? -1n : 1n;
  // Francs = cents / 100 * units per euro, to the nearest franc, halves up.
  const scaled = cents * sign * numerator;
  const divisor = 100n * denominator;
  const francs = (scaled * 2n + divisor) / (divisor * 2n);
  return { amountMinor: String(francs * sign), currency: parity.currency };
}
