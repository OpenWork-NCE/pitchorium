import { describe, expect, it } from 'vitest';
import type { ContributionRecord } from './contribution';
import { refundAmountOf, refundEffect } from './refund';

/** A paid contribution of 50 000 FCFA (76,22 EUR) with a commission of 2 500 FCFA. */
function paid(overrides: Partial<ContributionRecord> = {}): ContributionRecord {
  return {
    amountMinor: 50_000n,
    currency: 'XOF',
    eurMinor: 7_622n,
    commissionMinor: 2_500n,
    refundedMinor: 0n,
    refundedEurMinor: 0n,
    commissionRefundedMinor: 0n,
    lostMinor: 0n,
    lostEurMinor: 0n,
    status: 'succeeded',
    rewardState: 'confirmed',
    ...overrides,
  } as ContributionRecord;
}

describe('effect of a refund (preview of the console)', () => {
  it('gives back a share of the commission and removes euros from the project, in proportion', () => {
    expect(refundEffect(paid(), 20_000n)).toEqual({
      full: false,
      status: 'partially_refunded',
      commissionMinor: 1_000n,
      eurMinor: 3_048n,
      rewardReleased: false,
    });
  });

  it('gives the rest on the last part, and releases a confirmed reward', () => {
    const after = paid({
      refundedMinor: 20_000n,
      refundedEurMinor: 3_048n,
      commissionRefundedMinor: 1_000n,
      status: 'partially_refunded',
    });
    expect(refundEffect(after, 30_000n)).toEqual({
      full: true,
      status: 'refunded',
      commissionMinor: 1_500n,
      eurMinor: 4_574n,
      rewardReleased: true,
    });
  });

  it('refunds all that remains by default, never more, never another currency', () => {
    expect(refundAmountOf(paid(), undefined, 0n).toJSON()).toEqual({
      amountMinor: '50000',
      currency: 'XOF',
    });
    expect(refundAmountOf(paid(), undefined, 10_000n).toJSON().amountMinor).toBe('40000');
    const refused: { amountMinor: string; currency: string; pending?: bigint }[] = [
      { amountMinor: '50001', currency: 'XOF' },
      { amountMinor: '45000', currency: 'XOF', pending: 10_000n },
      { amountMinor: '100', currency: 'EUR' },
      { amountMinor: '0', currency: 'XOF' },
    ];
    for (const requested of refused) {
      expect(() =>
        refundAmountOf(
          paid(),
          { amountMinor: requested.amountMinor, currency: requested.currency },
          requested.pending ?? 0n,
        ),
      ).toThrow(expect.objectContaining({ code: 'PAYMENTS_REFUND_INVALID' }));
    }
  });
});
