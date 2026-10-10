import type {
  MobileMoneyOperator,
  PaymentCurrencyOption,
  PaymentMethod,
  PaymentUnavailableReason,
  UnavailablePaymentMethod,
} from '@pitchorium/contracts';

/** A method available in the currency of the payment, with its operators. */
export interface AvailableMethod {
  method: PaymentMethod;
  operators: MobileMoneyOperator[];
}

/**
 * The methods the api offers in a currency, in its order; none when the currency is not offered.
 * Nothing is added nor inferred: a method absent from the answer is not shown as available.
 */
export function availableMethods(
  currencies: readonly PaymentCurrencyOption[],
  currency: string | null,
): AvailableMethod[] {
  const option = currencies.find((entry) => entry.currency === currency);
  return (option?.methods ?? []).map(({ method, operators }) => ({ method, operators }));
}

/**
 * The methods the contributor cannot use here, each once with the first reason the api gives
 * (its order of checks, ADR 0135), and never a method that is available in the currency shown:
 * an answer read for another currency or amount cannot contradict the list of available ones.
 */
export function unavailableMethods(
  unavailable: readonly UnavailablePaymentMethod[],
  available: readonly AvailableMethod[],
): { method: PaymentMethod; reason: PaymentUnavailableReason }[] {
  const offered = new Set(available.map((entry) => entry.method));
  const seen = new Set<PaymentMethod>();
  const notices: { method: PaymentMethod; reason: PaymentUnavailableReason }[] = [];
  for (const entry of unavailable) {
    if (offered.has(entry.method) || seen.has(entry.method)) continue;
    seen.add(entry.method);
    notices.push({ method: entry.method, reason: entry.reason });
  }
  return notices;
}
