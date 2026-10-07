import { Money } from '../../../platform/kernel';
import { ceilDiv } from './routing';

/** Versioned commission rate, recorded on every contribution (ADR 0047). */
export interface CommissionTerms {
  rateBps: number;
  version: string;
}

/**
 * Commission on the amount of the contribution, in its currency, rounded down to the minor unit
 * in favour of the holder (ADR 0047, to be validated): 5 % of 10.99 EUR is 0.54 EUR.
 */
export function commissionOn(amount: Money, terms: CommissionTerms): Money {
  return Money.of((amount.amountMinor * BigInt(terms.rateBps)) / 10_000n, amount.currency);
}

/**
 * Share of `total` that follows `consumed` out of `base` (refunds, disputes), floor or ceiling.
 * Parts are computed as differences of shares, so that they never sum above the total and the
 * last part gives exactly the rest.
 */
export function cumulativeShare(
  total: bigint,
  base: bigint,
  consumed: bigint,
  rounding: 'floor' | 'ceil',
): bigint {
  if (consumed >= base) return total;
  return rounding === 'floor' ? (total * consumed) / base : ceilDiv(total * consumed, base);
}

export function partOf(
  total: bigint,
  base: bigint,
  consumedBefore: bigint,
  part: bigint,
  rounding: 'floor' | 'ceil',
): bigint {
  return (
    cumulativeShare(total, base, consumedBefore + part, rounding) -
    cumulativeShare(total, base, consumedBefore, rounding)
  );
}

/**
 * Commission refunded with a refund, in proportion (Stripe refunds the application fee in
 * proportion): rounded up, in favour of the holder, who bears the refund.
 */
export function commissionRefundFor(
  commission: bigint,
  amount: bigint,
  refundedBefore: bigint,
  refund: bigint,
): bigint {
  return partOf(commission, amount, refundedBefore, refund, 'ceil');
}

/** EUR equivalent of a refunded or lost part, rounded down; the last part gives the rest. */
export function eurPartFor(
  eurMinor: bigint,
  amount: bigint,
  consumedBefore: bigint,
  part: bigint,
): bigint {
  return partOf(eurMinor, amount, consumedBefore, part, 'floor');
}
