import type { PaymentMethod } from '@pitchorium/contracts';
import { Money } from '../../../platform/kernel';
import {
  PROVIDER_CAPABILITIES,
  type ProviderCapabilities,
  type ProviderId,
} from './capability-matrix';

export interface PayoutRoute {
  provider: ProviderId;
  country: string;
  currency: string;
}

/**
 * The route of the payout option a holder chose: the provider, enabled, has a verified payout
 * capability in this country (ADR 0134). The rail of a project follows from it, never from the
 * contributor nor from the country of a profile or a project (ADR 0043). Null otherwise.
 */
export function payoutRoute(
  provider: ProviderId,
  country: string,
  enabled: readonly ProviderId[],
): PayoutRoute | null {
  if (!enabled.includes(provider)) return null;
  const found = PROVIDER_CAPABILITIES[provider].payoutCountries.find(
    (entry) => entry.country === country && entry.verified,
  );
  return found ? { provider, country, currency: found.currency } : null;
}

/** An existing payout account is still covered: same route, same settlement currency. */
export function isCovered(
  account: { provider: ProviderId; country: string; currency: string },
  enabled: readonly ProviderId[],
): boolean {
  return payoutRoute(account.provider, account.country, enabled)?.currency === account.currency;
}

/**
 * Estimated fee of the provider from its published pricing, rounded up (the estimate never
 * promises the holder more than the actual fee would leave); null without a verified schedule.
 */
export function estimateFee(
  capabilities: ProviderCapabilities,
  payoutCountry: string,
  method: PaymentMethod,
  amount: Money,
): Money | null {
  const schedule = capabilities.fees.find(
    (fee) =>
      fee.verified &&
      fee.payoutCountry === payoutCountry &&
      fee.method === method &&
      fee.currency === amount.currency,
  );
  if (!schedule) return null;
  const base = ceilDiv(amount.amountMinor * BigInt(schedule.percentBps), 10_000n);
  const fee = base + schedule.fixedMinor;
  const vat = ceilDiv(fee * BigInt(schedule.vatOnFeeBps), 10_000n);
  return Money.of(fee + vat, amount.currency);
}

export function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}
