import { CURRENCY_EXPONENTS, currencyExponentOf } from '@pitchorium/contracts';
import { DomainError } from './domain-error';

/** Exponents of the active ISO 4217 currencies: `@pitchorium/contracts` (currency.ts). */
export function isActiveCurrency(code: string): boolean {
  return CURRENCY_EXPONENTS.has(code);
}

/** Number of decimals of the minor unit: EUR 2, XOF 0, KWD 3. */
export function currencyExponent(code: string): number {
  const exponent = currencyExponentOf(code);
  if (exponent === undefined) {
    throw new DomainError('VALIDATION_FAILED', `Unknown ISO 4217 currency: ${code}`);
  }
  return exponent;
}

/** 10 to the power of the exponent: minor units in one major unit. */
export function minorUnitsPerMajor(code: string): bigint {
  return 10n ** BigInt(currencyExponent(code));
}
