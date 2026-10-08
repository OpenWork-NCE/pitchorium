import { describe, expect, it } from 'vitest';
import { formatMoney, minorStep, moneyFormatOptions, toDecimalString, toMajor } from './money';

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

  it('formats from the exact decimal text, beyond the precision of a float', () => {
    expect(toDecimalString({ amountMinor: '1250', currency: 'EUR' })).toBe('12.50');
    expect(toDecimalString({ amountMinor: '7', currency: 'EUR' })).toBe('0.07');
    expect(toDecimalString({ amountMinor: '-1250', currency: 'EUR' })).toBe('-12.50');
    expect(toDecimalString({ amountMinor: '500000', currency: 'XAF' })).toBe('500000');
    expect(
      formatMoney({ amountMinor: '9007199254740993', currency: 'EUR' }, 'en', 'financial'),
    ).toBe('€90,071,992,547,409.93');
    expect(formatMoney({ amountMinor: '500000', currency: 'XAF' }, 'fr')).toBe(
      '500\u202f000\u00a0FCFA',
    );
  });

  it('drops zero decimals on display, keeps every decimal in a financial context', () => {
    const whole = { amountMinor: '1250000', currency: 'EUR' };
    expect(formatMoney(whole, 'fr')).toBe('12\u202f500\u00a0€');
    expect(formatMoney(whole, 'fr', 'financial')).toBe('12\u202f500,00\u00a0€');
    expect(formatMoney({ amountMinor: '1250050', currency: 'EUR' }, 'fr')).toBe(
      '12\u202f500,50\u00a0€',
    );
    expect(formatMoney({ amountMinor: '1250005', currency: 'EUR' }, 'en')).toBe('€12,500.05');
    expect(formatMoney({ amountMinor: '500000', currency: 'XAF' }, 'fr', 'financial')).toBe(
      '500\u202f000\u00a0FCFA',
    );
  });

  it('steps counters by the minor unit', () => {
    expect(minorStep('XOF')).toBe(1);
    expect(minorStep('EUR')).toBe(0.01);
  });
});
