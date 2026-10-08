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
 * How an amount is written: `display` (cards, totals, progress) drops the decimals when the minor
 * part is zero (12 500 €, but 12 500,50 €); `financial` (tables, quotes, receipts) always writes
 * every decimal of the currency (12 500,00 €).
 */
export type MoneyPrecision = 'display' | 'financial';

/** True when an amount has no minor part (`"1250000"` EUR is 12 500,00). */
export function isWholeAmount({ amountMinor, currency }: MoneyDto): boolean {
  const exponent = exponentOf(currency);
  return exponent === 0 || BigInt(amountMinor) % 10n ** BigInt(exponent) === 0n;
}

/**
 * Intl options of a currency amount: as many decimals as the minor unit (XAF none, EUR two),
 * whatever the defaults of the browser; none at all for a whole amount on display.
 */
export function moneyFormatOptions(
  currency: string,
  { whole = false }: { whole?: boolean } = {},
): Intl.NumberFormatOptions {
  const digits = whole ? 0 : exponentOf(currency);
  return {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
}

/**
 * Exact decimal text of an amount (`"1250"` EUR is `"12.50"`), for `Intl.NumberFormat`, which
 * formats a decimal string without going through a floating point number.
 */
export function toDecimalString({ amountMinor, currency }: MoneyDto): `${number}` {
  const exponent = exponentOf(currency);
  const negative = amountMinor.startsWith('-');
  const digits = (negative ? amountMinor.slice(1) : amountMinor).padStart(exponent + 1, '0');
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);
  return `${negative ? '-' : ''}${whole}${exponent > 0 ? `.${fraction}` : ''}` as `${number}`;
}

/**
 * An amount in the language of the page: on display without decimals when they are zero, in a
 * financial context with every decimal of its currency.
 */
export function formatMoney(
  money: MoneyDto,
  locale: string,
  precision: MoneyPrecision = 'display',
): string {
  const whole = precision === 'display' && isWholeAmount(money);
  return new Intl.NumberFormat(locale, moneyFormatOptions(money.currency, { whole })).format(
    toDecimalString(money),
  );
}
