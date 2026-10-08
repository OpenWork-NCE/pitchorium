import { describe, expect, it } from 'vitest';
import { minorStep, moneyFormatOptions, toMajor } from './money';

const format = (locale: string, amountMinor: string, currency: string) =>
  new Intl.NumberFormat(locale, moneyFormatOptions(currency)).format(
    toMajor({ amountMinor, currency }),
  );

describe('money', () => {
  it('follows the exponent of each currency', () => {
    // French: narrow no-break space between thousands, no-break space before the currency.
    expect(format('fr', '500000', 'XAF')).toBe('500\u202f000\u00a0FCFA');
    expect(format('fr', '1250', 'EUR')).toBe('12,50\u00a0€');
    expect(format('en', '1250', 'EUR')).toBe('€12.50');
    expect(format('en', '1500', 'KWD')).toBe('KWD\u00a01.500');
  });

  it('steps counters by the minor unit', () => {
    expect(minorStep('XOF')).toBe(1);
    expect(minorStep('EUR')).toBe(0.01);
  });
});
