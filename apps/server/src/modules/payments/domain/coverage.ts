import type { CoveredPayment, PaymentCoverage, ProviderCoverage } from '@pitchorium/contracts';
import { Money } from '../../../platform/kernel';
import {
  CAPABILITY_MATRIX_VERIFIED_AT,
  CAPABILITY_MATRIX_VERSION,
  PROVIDER_CAPABILITIES,
  type PaymentCapability,
  type ProviderCapabilities,
  type ProviderId,
} from './capability-matrix';

/** Providers in the order of the matrix. */
const ORDER: readonly ProviderId[] = ['stripe', 'flutterwave', 'simulated'];

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/**
 * The verified payout countries of a provider, and the verified payments a holder of one of them
 * may receive: a provider that takes payments in the payout currency only offers no capability in
 * a currency no verified payout country settles in (it would never be reachable).
 */
export function enabledCapabilities(capabilities: ProviderCapabilities): {
  payoutCountries: { country: string; currency: string }[];
  payments: PaymentCapability[];
} {
  const payoutCountries = capabilities.payoutCountries
    .filter((entry) => entry.verified)
    .map(({ country, currency }) => ({ country, currency }));
  const payoutCurrencies = new Set(payoutCountries.map((entry) => entry.currency));
  const payments = capabilities.payments.filter(
    (payment) =>
      payment.verified &&
      (capabilities.paymentCurrencies === 'any' || payoutCurrencies.has(payment.currency)),
  );
  return { payoutCountries, payments };
}

function coveredPayment(payment: PaymentCapability): CoveredPayment {
  return {
    currency: payment.currency,
    method: payment.method,
    operators: [...payment.operators],
    contributorCountries:
      payment.contributorCountries === '*' ? null : [...payment.contributorCountries],
    min: payment.minMinor === null ? null : Money.of(payment.minMinor, payment.currency).toJSON(),
    max: payment.maxMinor === null ? null : Money.of(payment.maxMinor, payment.currency).toJSON(),
  };
}

function providerCoverage(capabilities: ProviderCapabilities): ProviderCoverage {
  const { payoutCountries, payments } = enabledCapabilities(capabilities);
  return {
    provider: capabilities.provider,
    onboarding: capabilities.onboarding,
    kycMode: capabilities.kycMode,
    paymentCurrencyRule: capabilities.paymentCurrencies === 'any' ? 'any' : 'payout_currency',
    payoutCountries,
    payoutCurrencies: unique(payoutCountries.map((entry) => entry.currency)),
    paymentCurrencies: unique(payments.map((payment) => payment.currency)),
    payments: payments.map(coveredPayment),
    eligibility: {
      requirements: capabilities.eligibility.requirements.map((entry) => ({ ...entry })),
      documents: capabilities.eligibility.documents.map((entry) => ({ ...entry })),
    },
  };
}

/**
 * Public coverage (section 9.2): for each enabled provider, its verified payout countries,
 * currencies, payments by contributor country with their verified bounds, and what it asks of a
 * holder. A capability that is not verified, or not reachable, is absent: never offered.
 */
export function buildCoverage(enabled: readonly ProviderId[]): PaymentCoverage {
  return {
    matrixVersion: CAPABILITY_MATRIX_VERSION,
    verifiedAt: CAPABILITY_MATRIX_VERIFIED_AT,
    providers: ORDER.filter((provider) => enabled.includes(provider)).map((provider) =>
      providerCoverage(PROVIDER_CAPABILITIES[provider]),
    ),
  };
}
