import { exponentOf } from './money';

/** Separators of a locale for decimal numbers (`,` and a narrow space in French). */
export function separatorsOf(locale: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
  };
}

const SPACES = /[\s\u00a0\u202f]/g;

/**
 * Amount typed by a person, in minor units of the currency (`"12,50"` in French euros is
 * `"1250"`), without any floating point: the text is read digit by digit. Null when it is not an
 * amount of that currency (letters, too many decimals for its exponent, XAF with decimals).
 */
export function parseMoneyInput(text: string, locale: string, currency: string): string | null {
  const { decimal, group } = separatorsOf(locale);
  const exponent = exponentOf(currency);
  let compact = text.replace(SPACES, '');
  if (group.trim()) compact = compact.split(group).join('');
  // A dot typed on a French keyboard (or a comma on an English one) is read as the decimal mark
  // when it cannot be a group separator.
  const other = decimal === ',' ? '.' : ',';
  if (!compact.includes(decimal) && compact.split(other).length === 2 && !/\d{3}$/.test(compact)) {
    compact = compact.replace(other, decimal);
  }
  if (compact === '') return null;
  const [whole = '', fraction = '', ...rest] = compact.split(decimal);
  if (rest.length > 0 || !/^\d*$/.test(whole) || !/^\d*$/.test(fraction)) return null;
  if (whole === '' && fraction === '') return null;
  if (fraction.length > exponent) return null;
  const minor = `${whole}${fraction.padEnd(exponent, '0')}`.replace(/^0+(?=\d)/, '');
  return minor === '' ? '0' : minor;
}

/** Minor units shown in the field, grouped and with the decimals of the currency, no symbol. */
export function formatMoneyInput(minor: string, locale: string, currency: string): string {
  const exponent = exponentOf(currency);
  const digits = minor.replace(/^0+(?=\d)/, '').padStart(exponent + 1, '0');
  const whole = digits.slice(0, digits.length - exponent);
  const fraction = digits.slice(digits.length - exponent);
  const { decimal } = separatorsOf(locale);
  // Grouping of the whole part through Intl, on a BigInt: exact for any size.
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(whole));
  return exponent === 0 ? grouped : `${grouped}${decimal}${fraction}`;
}

/** Symbol of the currency and its side in that locale (`€` after in French, before in English). */
export function currencyAffix(
  locale: string,
  currency: string,
): { symbol: string; position: 'prefix' | 'suffix' } {
  const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(1);
  const symbolIndex = parts.findIndex((part) => part.type === 'currency');
  const numberIndex = parts.findIndex((part) => part.type === 'integer');
  return {
    symbol: parts[symbolIndex]?.value ?? currency,
    position: symbolIndex < numberIndex ? 'prefix' : 'suffix',
  };
}
