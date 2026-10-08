import { currencyExponentOf, type MoneyDto } from '@pitchorium/contracts';

/** Exponent of the currency (ISO 4217 table of the contracts); two decimals if unknown. */
export function exponentOf(currency: string): number {
  return currencyExponentOf(currency) ?? 2;
}

/** Major units of an amount in minor units (`"500000"` XAF is 500000, `"1250"` EUR is 12.5). */
export function toMajor({ amountMinor, currency }: MoneyDto): number {
  return Number(BigInt(amountMinor)) / 10 ** exponentOf(currency);
}

/** Smallest displayable step of a currency, for the animated counters. */
export function minorStep(currency: string): number {
  return 10 ** -exponentOf(currency);
}

/**
 * Intl options of a currency amount: as many decimals as the minor unit (XAF none, EUR two),
 * whatever the defaults of the browser.
 */
export function moneyFormatOptions(currency: string): Intl.NumberFormatOptions {
  const digits = exponentOf(currency);
  return {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
}
