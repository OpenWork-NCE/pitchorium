import type {
  CoveredPayment,
  MobileMoneyOperator,
  PaymentCoverage,
  PaymentMethod,
  PaymentProvider,
  ProviderCoverage,
} from '@pitchorium/contracts';

/**
 * Reading of the public coverage of the payments (ADR 0133, ADR 0139) for the payout choice:
 * what is listed comes from the api only. The page filters it by the country the holder chooses
 * and applies the currency rule each provider declares (`paymentCurrencyRule`); it never adds a
 * country, a method or an operator.
 */

/** Every country a payout account may be opened in, once each, in the order of the api. */
export function payoutCountries(coverage: PaymentCoverage): string[] {
  const countries = new Set<string>();
  for (const provider of coverage.providers) {
    for (const { country } of provider.payoutCountries) countries.add(country);
  }
  return [...countries];
}

/** A method contributors can use, with its operators and the countries it serves. */
export interface ContributorMethod {
  method: PaymentMethod;
  currency: string;
  operators: MobileMoneyOperator[];
  /** Null for every country. */
  contributorCountries: string[] | null;
}

export interface PayoutOption {
  provider: PaymentProvider;
  country: string;
  /** Currency the account is settled in. */
  currency: string;
  coverage: ProviderCoverage;
  /** What its contributors can pay with, in the currencies this account accepts. */
  methods: ContributorMethod[];
  /** Methods another option of the coverage offers and this one does not. */
  notCovered: { method: PaymentMethod; operators: MobileMoneyOperator[] }[];
}

/** Payments of a provider that reach an account settled in `currency`, by its own rule. */
function paymentsFor(provider: ProviderCoverage, currency: string): CoveredPayment[] {
  return provider.paymentCurrencyRule === 'payout_currency'
    ? provider.payments.filter((payment) => payment.currency === currency)
    : provider.payments;
}

function asMethods(payments: readonly CoveredPayment[]): ContributorMethod[] {
  return payments.map((payment) => ({
    method: payment.method,
    currency: payment.currency,
    operators: payment.operators,
    contributorCountries: payment.contributorCountries,
  }));
}

/** The covered options for an account in this country, in the order of the api. */
export function payoutOptions(coverage: PaymentCoverage, country: string): PayoutOption[] {
  const options = coverage.providers.flatMap((provider) => {
    const entry = provider.payoutCountries.find((candidate) => candidate.country === country);
    return entry
      ? [
          {
            provider: provider.provider,
            country,
            currency: entry.currency,
            coverage: provider,
            methods: asMethods(paymentsFor(provider, entry.currency)),
          },
        ]
      : [];
  });
  // What the whole coverage offers, method by method with its operators.
  const everywhere = new Map<PaymentMethod, Set<MobileMoneyOperator>>();
  for (const provider of coverage.providers) {
    for (const payment of provider.payments) {
      const operators = everywhere.get(payment.method) ?? new Set();
      for (const operator of payment.operators) operators.add(operator);
      everywhere.set(payment.method, operators);
    }
  }
  return options.map((option) => {
    const own = new Map<PaymentMethod, Set<MobileMoneyOperator>>();
    for (const method of option.methods) {
      const operators = own.get(method.method) ?? new Set();
      for (const operator of method.operators) operators.add(operator);
      own.set(method.method, operators);
    }
    const notCovered = [...everywhere].flatMap(([method, operators]) => {
      const mine = own.get(method);
      if (!mine) return [{ method, operators: [...operators] }];
      const missing = [...operators].filter((operator) => !mine.has(operator));
      return missing.length > 0 ? [{ method, operators: missing }] : [];
    });
    return { ...option, notCovered };
  });
}
