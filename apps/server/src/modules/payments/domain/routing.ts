import type { MobileMoneyOperator, PaymentMethod } from '@pitchorium/contracts';
import { DomainError, Money } from '../../../platform/kernel';
import {
  type PaymentCapability,
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

function serves(capability: PaymentCapability, contributorCountry: string | null): boolean {
  if (capability.contributorCountries === '*') return true;
  return (
    contributorCountry !== null && capability.contributorCountries.includes(contributorCountry)
  );
}

/**
 * Verified payment capabilities for this contributor and this payout route: what the
 * contribution page offers, without the plumbing (section 9.2).
 */
export function availablePayments(
  route: PayoutRoute,
  contributorCountry: string | null,
): PaymentCapability[] {
  const capabilities = PROVIDER_CAPABILITIES[route.provider];
  return capabilities.payments.filter(
    (capability) =>
      capability.verified &&
      serves(capability, contributorCountry) &&
      (capabilities.paymentCurrencies === 'any' || capability.currency === route.currency),
  );
}

/** Groups the methods by currency, operators merged; currencies in order of first appearance. */
export function methodsByCurrency(
  payments: readonly PaymentCapability[],
): Map<string, { method: PaymentMethod; operators: MobileMoneyOperator[] }[]> {
  const grouped = new Map<string, Map<PaymentMethod, Set<MobileMoneyOperator>>>();
  for (const capability of payments) {
    const methods =
      grouped.get(capability.currency) ?? new Map<PaymentMethod, Set<MobileMoneyOperator>>();
    const operators = methods.get(capability.method) ?? new Set<MobileMoneyOperator>();
    for (const operator of capability.operators) operators.add(operator);
    methods.set(capability.method, operators);
    grouped.set(capability.currency, methods);
  }
  return new Map(
    [...grouped].map(([currency, methods]) => [
      currency,
      [...methods].map(([method, operators]) => ({ method, operators: [...operators] })),
    ]),
  );
}

/** The capability a contribution uses, or the stable refusal of the currency or the method. */
export function requirePayment(
  route: PayoutRoute,
  contributorCountry: string | null,
  currency: string,
  method: PaymentMethod,
): PaymentCapability {
  const payments = availablePayments(route, contributorCountry);
  const inCurrency = payments.filter((capability) => capability.currency === currency);
  if (inCurrency.length === 0) {
    throw new DomainError(
      'PAYMENTS_CURRENCY_NOT_AVAILABLE',
      `Payments in ${currency} are not available for this contribution`,
    );
  }
  const found = inCurrency.find((capability) => capability.method === method);
  if (!found) {
    throw new DomainError(
      'PAYMENTS_METHOD_NOT_AVAILABLE',
      `Payment method ${method} is not available in ${currency}`,
    );
  }
  return found;
}

/** Narrowest provider bounds of a currency over the given capabilities. */
export function providerBounds(payments: readonly PaymentCapability[]): {
  minMinor: bigint | null;
  maxMinor: bigint | null;
} {
  let minMinor: bigint | null = null;
  let maxMinor: bigint | null = null;
  for (const capability of payments) {
    if (capability.minMinor !== null && (minMinor === null || capability.minMinor > minMinor)) {
      minMinor = capability.minMinor;
    }
    if (capability.maxMinor !== null && (maxMinor === null || capability.maxMinor < maxMinor)) {
      maxMinor = capability.maxMinor;
    }
  }
  return { minMinor, maxMinor };
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
