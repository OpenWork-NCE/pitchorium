import { describe, expect, it } from 'vitest';
import { indicativeEquivalent } from './indicative-equivalent';

const XOF = { currency: 'XOF', unitsPerEur: '655.957' } as const;
const eur = (cents: bigint) => ({ amountMinor: String(cents), currency: 'EUR' });

describe('indicative equivalent in CFA francs', () => {
  it('converts euros at the fixed parity exactly, to the nearest franc', () => {
    expect(indicativeEquivalent(eur(100n), XOF)).toEqual({ amountMinor: '656', currency: 'XOF' });
    // 12 500 EUR are 8 199 462.5 XOF: the half goes up.
    expect(indicativeEquivalent(eur(1_250_000n), XOF)).toEqual({
      amountMinor: '8199463',
      currency: 'XOF',
    });
    // 20 000 EUR are 13 119 140 XOF exactly.
    expect(indicativeEquivalent(eur(2_000_000n), XOF)).toEqual({
      amountMinor: '13119140',
      currency: 'XOF',
    });
    // 1 cent is 6.55957 XOF: 7.
    expect(indicativeEquivalent(eur(1n), XOF)).toEqual({ amountMinor: '7', currency: 'XOF' });
    expect(indicativeEquivalent(eur(0n), XOF)).toEqual({ amountMinor: '0', currency: 'XOF' });
  });

  it('keeps the franc of the reader, XAF as XOF', () => {
    expect(
      indicativeEquivalent(eur(100_000n), { currency: 'XAF', unitsPerEur: '655.957' }),
    ).toEqual({ amountMinor: '655957', currency: 'XAF' });
  });

  it('gives nothing for an amount that is not in euros or a parity it cannot read', () => {
    expect(indicativeEquivalent({ amountMinor: '100', currency: 'XOF' }, XOF)).toBeNull();
    expect(indicativeEquivalent(eur(100n), { currency: 'XOF', unitsPerEur: 'abc' })).toBeNull();
  });
});
