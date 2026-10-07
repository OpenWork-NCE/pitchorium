import { describe, expect, it } from 'vitest';
import { DomainError } from './domain-error';
import { Money } from './money';

const eur = (amount: bigint | string) => Money.of(amount, 'EUR');

describe('Money', () => {
  it('accepts bigint and integer strings, and serializes amounts as strings', () => {
    expect(eur(1050n).toJSON()).toEqual({ amountMinor: '1050', currency: 'EUR' });
    expect(Money.fromJSON({ amountMinor: '-25', currency: 'XOF' }).amountMinor).toBe(-25n);
    expect(Money.zero('XAF').isZero()).toBe(true);
  });

  it.each([
    ['12.5', 'EUR'],
    ['01', 'EUR'],
    ['1e3', 'EUR'],
    ['10', 'eur'],
    ['10', 'EURO'],
  ])('rejects amount %s in %s', (amount, currency) => {
    expect(() => Money.of(amount, currency)).toThrow(DomainError);
  });

  it('adds, subtracts, multiplies and negates without precision loss', () => {
    const big = eur('900719925474099312345');
    expect(big.add(eur(1n)).toJSON().amountMinor).toBe('900719925474099312346');
    expect(eur(500n).subtract(eur(750n)).amountMinor).toBe(-250n);
    expect(eur(333n).multiply(3n).amountMinor).toBe(999n);
    expect(eur(10n).negate().amountMinor).toBe(-10n);
  });

  it('refuses to mix currencies', () => {
    const xof = Money.of(100n, 'XOF');
    expect(() => eur(100n).add(xof)).toThrow('Currency mismatch: EUR and XOF');
    expect(() => eur(100n).subtract(xof)).toThrow(DomainError);
    expect(() => eur(100n).compare(xof)).toThrow(DomainError);
  });

  it('compares and tests sign', () => {
    expect(eur(1n).compare(eur(2n))).toBe(-1);
    expect(eur(2n).compare(eur(2n))).toBe(0);
    expect(eur(3n).compare(eur(2n))).toBe(1);
    expect(eur(5n).equals(eur(5n))).toBe(true);
    expect(eur(5n).equals(Money.of(5n, 'USD'))).toBe(false);
    expect(eur(1n).isPositive()).toBe(true);
    expect(eur(-1n).isNegative()).toBe(true);
    expect(eur(0n).isPositive() || eur(0n).isNegative()).toBe(false);
  });

  describe('allocate', () => {
    it('splits without losing a minor unit, remainder first', () => {
      const shares = eur(1000n)
        .allocate([1n, 1n, 1n])
        .map((share) => share.amountMinor);
      expect(shares).toEqual([334n, 333n, 333n]);
    });

    it('follows uneven ratios', () => {
      const shares = eur(10_001n)
        .allocate([5n, 95n])
        .map((share) => share.amountMinor);
      expect(shares).toEqual([501n, 9500n]);
    });

    it('keeps the sign of negative amounts and skips zero ratios', () => {
      const shares = eur(-5n)
        .allocate([0n, 1n, 1n])
        .map((share) => share.amountMinor);
      expect(shares).toEqual([0n, -3n, -2n]);
    });

    it.each([[[]], [[1n, -1n]], [[0n, 0n]]])('rejects invalid ratios (case %#)', (ratios) => {
      expect(() => eur(10n).allocate(ratios)).toThrow(DomainError);
    });
  });
});
