import {
  type MobileMoneyOperator,
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentUnavailableReason,
  type ProjectPaymentAvailability,
  type ProjectStatus,
} from '@pitchorium/contracts';
import {
  PROVIDER_CAPABILITIES,
  type PaymentCapability,
  type ProviderId,
} from './capability-matrix';
import { enabledCapabilities } from './coverage';
import type { PayoutRoute } from './routing';

/**
 * Whether a project takes collected contributions now (ADR 0135), in this order: a campaign
 * closed or frozen by the moderation, then the holder: a payout account the coverage serves,
 * then an active account and a verified identity.
 */
export function projectPaymentAvailability(
  project: { open: boolean; status: ProjectStatus },
  holder: { covered: boolean; collecting: boolean },
): ProjectPaymentAvailability {
  if (!project.open) {
    // A shown project in funding that is not open was frozen by the moderation.
    return project.status === 'funding' || project.status === 'funded'
      ? 'funding_frozen'
      : 'campaign_closed';
  }
  if (!holder.covered) return 'holder_without_covered_payout_account';
  if (!holder.collecting) return 'holder_not_verified';
  return 'open';
}

/** Methods the enabled providers offer somewhere, in the order of the contracts. */
export function offeredMethods(enabled: readonly ProviderId[]): PaymentMethod[] {
  const offered = new Set(
    enabled.flatMap((provider) =>
      enabledCapabilities(PROVIDER_CAPABILITIES[provider]).payments.map(
        (payment) => payment.method,
      ),
    ),
  );
  return PAYMENT_METHODS.filter((method) => offered.has(method));
}

/** Bounds of a payment in minor units of its currency. */
export interface Bounds {
  minMinor: bigint;
  maxMinor: bigint;
}

export interface PaymentRequest {
  contributorCountry: string | null;
  /** Currency asked by the contributor, any when absent. */
  currency?: string | undefined;
  /** Amount in minor units of `currency`. */
  amountMinor?: bigint | undefined;
}

export interface AvailablePayment {
  capability: PaymentCapability;
  bounds: Bounds;
}

export interface PaymentEvaluation {
  available: AvailablePayment[];
  unavailable: { method: PaymentMethod; reason: PaymentUnavailableReason }[];
}

/** Order in which the reasons are checked: a later one means a method came closer. */
const REASONS: readonly PaymentUnavailableReason[] = [
  'not_covered_by_holder_rail',
  'contributor_country_not_covered',
  'currency_not_supported',
  'amount_out_of_range',
];

function serves(capability: PaymentCapability, contributorCountry: string | null): boolean {
  if (capability.contributorCountries === '*') return true;
  return (
    contributorCountry !== null && capability.contributorCountries.includes(contributorCountry)
  );
}

/** The platform bounds in a currency, narrowed by the verified bounds of the provider. */
function narrowed(capability: PaymentCapability, platform: Bounds): Bounds {
  return {
    minMinor:
      capability.minMinor !== null && capability.minMinor > platform.minMinor
        ? capability.minMinor
        : platform.minMinor,
    maxMinor:
      capability.maxMinor !== null && capability.maxMinor < platform.maxMinor
        ? capability.maxMinor
        : platform.maxMinor,
  };
}

/**
 * Each method of `methods`, available on the rail of the holder for this request, or the reason
 * it is not (ADR 0135), checked in this order: offered by the rail of the holder (provider and,
 * for a provider paying in the payout currency only, that currency), serving the country of the
 * contributor, in the currency asked (a currency without a rate is not supported), the amount
 * within its bounds. `platformBounds` gives the platform bounds in a currency, null without a
 * rate. Options, quotes and contributions decide with this one function.
 */
export function evaluatePayments(
  route: PayoutRoute,
  methods: readonly PaymentMethod[],
  request: PaymentRequest,
  platformBounds: (currency: string) => Bounds | null,
): PaymentEvaluation {
  const capabilities = PROVIDER_CAPABILITIES[route.provider];
  const onRail = enabledCapabilities(capabilities).payments.filter(
    (payment) => capabilities.paymentCurrencies === 'any' || payment.currency === route.currency,
  );
  const evaluation: PaymentEvaluation = { available: [], unavailable: [] };
  for (const method of methods) {
    const offered = onRail.filter((payment) => payment.method === method);
    const served = offered.filter((payment) => serves(payment, request.contributorCountry));
    const inCurrency = served.flatMap((payment) => {
      const platform = platformBounds(payment.currency);
      if (!platform || (request.currency && payment.currency !== request.currency)) return [];
      const bounds = narrowed(payment, platform);
      return bounds.minMinor <= bounds.maxMinor ? [{ capability: payment, bounds }] : [];
    });
    const amount = request.amountMinor;
    const within =
      amount === undefined
        ? inCurrency
        : inCurrency.filter(({ bounds }) => amount >= bounds.minMinor && amount <= bounds.maxMinor);
    const reason =
      offered.length === 0
        ? 'not_covered_by_holder_rail'
        : served.length === 0
          ? 'contributor_country_not_covered'
          : inCurrency.length === 0
            ? 'currency_not_supported'
            : within.length === 0
              ? 'amount_out_of_range'
              : null;
    if (reason) evaluation.unavailable.push({ method, reason });
    else evaluation.available.push(...within);
  }
  return evaluation;
}

/**
 * The reason no method takes a request: the one of the method that came closest, so that a
 * contributor is told what to change (`not_covered_by_holder_rail` when none is offered).
 */
export function closestReason(evaluation: PaymentEvaluation): PaymentUnavailableReason {
  let closest = 0;
  for (const { reason } of evaluation.unavailable) {
    closest = Math.max(closest, REASONS.indexOf(reason));
  }
  return REASONS[closest] ?? 'not_covered_by_holder_rail';
}

export interface MethodOption {
  method: PaymentMethod;
  operators: MobileMoneyOperator[];
  bounds: Bounds;
}

/**
 * The available methods grouped by currency, in order of first appearance: operators merged,
 * bounds widened over the capabilities of a method (one per contributor country at most).
 */
export function methodsByCurrency(
  available: readonly AvailablePayment[],
): Map<string, MethodOption[]> {
  const grouped = new Map<string, Map<PaymentMethod, MethodOption>>();
  for (const { capability, bounds } of available) {
    const methods = grouped.get(capability.currency) ?? new Map<PaymentMethod, MethodOption>();
    const current = methods.get(capability.method);
    methods.set(capability.method, {
      method: capability.method,
      operators: [...new Set([...(current?.operators ?? []), ...capability.operators])],
      bounds: current
        ? {
            minMinor:
              bounds.minMinor < current.bounds.minMinor ? bounds.minMinor : current.bounds.minMinor,
            maxMinor:
              bounds.maxMinor > current.bounds.maxMinor ? bounds.maxMinor : current.bounds.maxMinor,
          }
        : bounds,
    });
    grouped.set(capability.currency, methods);
  }
  return new Map([...grouped].map(([currency, methods]) => [currency, [...methods.values()]]));
}
