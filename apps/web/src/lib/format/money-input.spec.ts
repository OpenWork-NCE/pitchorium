import { describe, expect, it } from 'vitest';
import { currencyAffix, formatMoneyInput, parseMoneyInput } from './money-input';

describe('money input', () => {
  it('reads a French amount in minor units, without floating point', () => {
    expect(parseMoneyInput('12,50', 'fr', 'EUR')).toBe('1250');
    expect(parseMoneyInput('1 234,5', 'fr', 'EUR')).toBe('123450');
    expect(parseMoneyInput('1 234 567,89', 'fr', 'EUR')).toBe('123456789');
    expect(parseMoneyInput('0,07', 'fr', 'EUR')).toBe('7');
    expect(parseMoneyInput('12.5', 'fr', 'EUR')).toBe('1250');
  });

  it('reads an English amount and big amounts exactly', () => {
    expect(parseMoneyInput('1,234.56', 'en', 'EUR')).toBe('123456');
    expect(parseMoneyInput('90071992547409.93', 'en', 'EUR')).toBe('9007199254740993');
  });

  it('follows the exponent of the currency', () => {
    expect(parseMoneyInput('2 500 000', 'fr', 'XAF')).toBe('2500000');
    expect(parseMoneyInput('2 500,5', 'fr', 'XAF')).toBeNull();
    expect(parseMoneyInput('1,234', 'fr', 'EUR')).toBeNull();
  });

  it('refuses what is not an amount', () => {
    for (const text of ['', 'abc', '12,5,1', '-3', '1e3']) {
      expect(parseMoneyInput(text, 'fr', 'EUR')).toBeNull();
    }
  });

  it('shows minor units grouped with the decimals of the currency', () => {
    expect(formatMoneyInput('123450', 'fr', 'EUR')).toBe('1 234,50');
    expect(formatMoneyInput('7', 'en', 'EUR')).toBe('0.07');
    expect(formatMoneyInput('2500000', 'fr', 'XAF')).toBe('2 500 000');
    expect(formatMoneyInput('9007199254740993', 'en', 'EUR')).toBe('90,071,992,547,409.93');
  });

  it('places the symbol as the locale does', () => {
    expect(currencyAffix('fr', 'EUR')).toEqual({ symbol: '€', position: 'suffix' });
    expect(currencyAffix('en', 'EUR')).toEqual({ symbol: '€', position: 'prefix' });
  });
});
