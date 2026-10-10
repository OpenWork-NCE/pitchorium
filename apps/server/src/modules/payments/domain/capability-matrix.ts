import type {
  MobileMoneyOperator,
  PaymentMethod,
  PaymentProvider,
  PayoutDocument,
  PayoutRequirement,
  PayoutRequirementScope,
} from '@pitchorium/contracts';

/**
 * Capabilities of the payment providers (section 9.2), as configuration data. Every entry gives
 * the official documentation it was checked against on the date below; an entry whose
 * capability could not be confirmed there is `verified: false` and never offered (ADR 0043).
 * Changing an entry means checking the source again and bumping the version.
 * @public Recorded in docs/architecture/payments.md.
 */
export const CAPABILITY_MATRIX_VERSION = '2026-10-10';

/** Every verified entry was checked in the documentation of its provider on this date or later. */
export const CAPABILITY_MATRIX_VERIFIED_AT = '2026-10-07';

export type ProviderId = PaymentProvider;

/** Contributor countries a payment capability serves: every country, or a list. */
export type ContributorCountries = '*' | readonly string[];

export interface PayoutCountryCapability {
  country: string;
  /** Currency of the funds received by the holder. */
  currency: string;
  verified: boolean;
  sources: readonly string[];
  note?: string;
}

export interface PaymentCapability {
  currency: string;
  method: PaymentMethod;
  /** Mobile money operators, empty for the other methods. */
  operators: readonly MobileMoneyOperator[];
  contributorCountries: ContributorCountries;
  /** Provider minimum and maximum in minor units of the currency, null when not documented. */
  minMinor: bigint | null;
  maxMinor: bigint | null;
  verified: boolean;
  sources: readonly string[];
  note?: string;
}

/** Published pricing used for the estimate of the quote; the actual fee comes afterwards. */
export interface FeeSchedule {
  payoutCountry: string;
  method: PaymentMethod;
  currency: string;
  percentBps: number;
  fixedMinor: bigint;
  /** VAT charged on the fee itself (7.5 % in Nigeria). */
  vatOnFeeBps: number;
  verified: boolean;
  sources: readonly string[];
}

/** What the provider asks of a holder to open a payout account, from its documentation. */
export interface ProviderEligibility {
  requirements: readonly { code: PayoutRequirement; scope: PayoutRequirementScope }[];
  documents: readonly { code: PayoutDocument; scope: PayoutRequirementScope }[];
  sources: readonly string[];
}

export interface ProviderCapabilities {
  provider: ProviderId;
  /** How the holder onboards: hosted pages of the provider, or bank details sent from here. */
  onboarding: 'hosted' | 'bank_details';
  /** Who verifies the identity of the holder (ADR 0050). */
  kycMode: 'provider' | 'manual_review';
  /**
   * `local`: a payment is made in the currency of the payout account only; `any`: in any
   * currency of the payment capabilities.
   */
  paymentCurrencies: 'local' | 'any';
  payoutCountries: readonly PayoutCountryCapability[];
  payments: readonly PaymentCapability[];
  fees: readonly FeeSchedule[];
  eligibility: ProviderEligibility;
}

const STRIPE = {
  global: 'https://stripe.com/global',
  charges: 'https://docs.stripe.com/connect/charges',
  crossBorder: 'https://docs.stripe.com/connect/cross-border-payouts',
  currencies: 'https://docs.stripe.com/currencies',
  methods: 'https://docs.stripe.com/payments/payment-methods/payment-method-support',
  connectMethods: 'https://docs.stripe.com/payments/payment-methods/payment-method-connect-support',
  sepa: 'https://docs.stripe.com/payments/sepa-debit',
  pricing: 'https://stripe.com/fr/pricing',
  otherCountry:
    'https://support.stripe.com/questions/requirements-to-open-a-stripe-account-in-another-country',
  documents: 'https://docs.stripe.com/acceptable-verification-documents',
  requirements: 'https://docs.stripe.com/connect/required-verification-information',
} as const;

const FLUTTERWAVE = {
  split: 'https://developer.flutterwave.com/v3.0/docs/split-payments',
  methods: 'https://developer.flutterwave.com/v3.0/docs/payment-methods',
  francophone: 'https://developer.flutterwave.com/v3.0/docs/francophone',
  ghana: 'https://developer.flutterwave.com/v3.0/docs/ghana',
  mpesa: 'https://developer.flutterwave.com/v3.0/docs/m-pesa',
  uganda: 'https://developer.flutterwave.com/v3.0/docs/uganda',
  pricingNg: 'https://flutterwave.com/ng/pricing',
} as const;

/**
 * Euro area countries where Stripe accounts are available (stripe.com/global): direct charges
 * settle in the country of the connected account, in EUR. The other countries of the EEA, the
 * United Kingdom and Switzerland settle in another currency, a conversion this version does not
 * model: not offered. Africa appears only as « extended network » through Paystack, and
 * cross-border payouts from an EEA platform reach the US, UK, EEA, Canada and Switzerland only.
 */
const STRIPE_EURO_PAYOUT_COUNTRIES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PT',
  'SK',
  'SI',
  'ES',
] as const;

const STRIPE_UNVERIFIED_PAYOUT_COUNTRIES = [
  'NG',
  'KE',
  'GH',
  'ZA',
  'CI',
  'SN',
  'CM',
  'GB',
  'CH',
] as const;

export const STRIPE_CAPABILITIES: ProviderCapabilities = {
  provider: 'stripe',
  onboarding: 'hosted',
  kycMode: 'provider',
  paymentCurrencies: 'any',
  payoutCountries: [
    ...STRIPE_EURO_PAYOUT_COUNTRIES.map((country) => ({
      country,
      currency: 'EUR',
      verified: true,
      sources: [STRIPE.global, STRIPE.charges],
    })),
    ...STRIPE_UNVERIFIED_PAYOUT_COUNTRIES.map((country) => ({
      country,
      currency: '',
      verified: false,
      sources: [STRIPE.global, STRIPE.crossBorder],
      note: 'Extended network (Paystack), cross-border payout or non-EUR settlement: not self-serve for an EEA platform with direct charges.',
    })),
  ],
  payments: [
    {
      currency: 'EUR',
      method: 'card',
      operators: [],
      contributorCountries: '*',
      minMinor: 50n,
      maxMinor: 999_999_999_999n,
      verified: true,
      sources: [STRIPE.currencies, STRIPE.methods],
    },
    {
      currency: 'EUR',
      method: 'sepa_debit',
      operators: [],
      contributorCountries: '*',
      minMinor: 50n,
      maxMinor: 1_000_000n,
      verified: true,
      sources: [STRIPE.sepa, STRIPE.connectMethods],
      note: 'Delayed notification: success known about six business days later; 10,000 EUR per transaction.',
    },
    {
      currency: 'EUR',
      method: 'apple_pay',
      operators: [],
      contributorCountries: '*',
      minMinor: 50n,
      maxMinor: 999_999_999_999n,
      verified: true,
      sources: [STRIPE.methods],
      note: 'Shown by Checkout on supported devices and locations only.',
    },
    {
      currency: 'EUR',
      method: 'google_pay',
      operators: [],
      contributorCountries: '*',
      minMinor: 50n,
      maxMinor: 999_999_999_999n,
      verified: true,
      sources: [STRIPE.methods],
      note: 'Shown by Checkout on supported devices and locations only.',
    },
    {
      currency: 'EUR',
      method: 'paypal',
      operators: [],
      contributorCountries: '*',
      minMinor: null,
      maxMinor: null,
      verified: false,
      sources: [STRIPE.connectMethods],
      note: 'PayPal does not support direct charges with Connect.',
    },
  ],
  fees: [
    {
      payoutCountry: 'FR',
      method: 'card',
      currency: 'EUR',
      percentBps: 150,
      fixedMinor: 25n,
      vatOnFeeBps: 0,
      verified: true,
      sources: [STRIPE.pricing],
    },
    {
      payoutCountry: 'FR',
      method: 'apple_pay',
      currency: 'EUR',
      percentBps: 150,
      fixedMinor: 25n,
      vatOnFeeBps: 0,
      verified: true,
      sources: [STRIPE.pricing],
    },
    {
      payoutCountry: 'FR',
      method: 'google_pay',
      currency: 'EUR',
      percentBps: 150,
      fixedMinor: 25n,
      vatOnFeeBps: 0,
      verified: true,
      sources: [STRIPE.pricing],
    },
    {
      payoutCountry: 'FR',
      method: 'sepa_debit',
      currency: 'EUR',
      percentBps: 0,
      fixedMinor: 35n,
      vatOnFeeBps: 0,
      verified: true,
      sources: [STRIPE.pricing],
    },
  ],
  /**
   * Checked on 2026-10-10. A business account needs a legal entity registered in the country of
   * the account; every account a physical address there where mail is received (not a P.O. box),
   * a phone number and a bank account in that country (otherCountry). A person whose country of
   * residence differs from the country of the account verifies their identity with a passport
   * (documents). Website, terms of service and bank account appear among the requirements of an
   * account in France (requirements). The country of an account cannot change afterwards.
   */
  eligibility: {
    requirements: [
      { code: 'address_in_payout_country', scope: 'all' },
      { code: 'bank_account_in_payout_country', scope: 'all' },
      { code: 'phone_number', scope: 'all' },
      { code: 'business_website', scope: 'all' },
      { code: 'provider_terms_acceptance', scope: 'all' },
      { code: 'company_registered_in_payout_country', scope: 'company' },
      { code: 'tax_id', scope: 'company' },
    ],
    documents: [
      { code: 'identity_document', scope: 'all' },
      { code: 'passport_if_resident_elsewhere', scope: 'all' },
      { code: 'company_registration_document', scope: 'company' },
    ],
    sources: [STRIPE.otherCountry, STRIPE.documents, STRIPE.requirements],
  },
};

export const FLUTTERWAVE_CAPABILITIES: ProviderCapabilities = {
  provider: 'flutterwave',
  onboarding: 'bank_details',
  kycMode: 'manual_review',
  paymentCurrencies: 'local',
  payoutCountries: [
    { country: 'NG', currency: 'NGN', verified: true, sources: [FLUTTERWAVE.split] },
    { country: 'GH', currency: 'GHS', verified: true, sources: [FLUTTERWAVE.split] },
    { country: 'RW', currency: 'RWF', verified: true, sources: [FLUTTERWAVE.split] },
    { country: 'TZ', currency: 'TZS', verified: true, sources: [FLUTTERWAVE.split] },
    { country: 'UG', currency: 'UGX', verified: true, sources: [FLUTTERWAVE.split] },
    ...(
      [
        ['KE', 'KES'],
        ['CI', 'XOF'],
        ['SN', 'XOF'],
        ['BF', 'XOF'],
        ['CM', 'XAF'],
        ['ZA', 'ZAR'],
      ] as const
    ).map(([country, currency]) => ({
      country,
      currency,
      verified: false,
      sources: [FLUTTERWAVE.split],
      note: 'Collection subaccounts in this country are not documented: to confirm with Flutterwave.',
    })),
  ],
  payments: [
    ...(['card', 'bank_transfer', 'bank_account', 'ussd'] as const).map((method) => ({
      currency: 'NGN',
      method,
      operators: [],
      contributorCountries: method === 'card' ? ('*' as const) : ['NG'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.methods],
    })),
    ...(['GHS', 'UGX', 'RWF', 'TZS', 'XOF', 'XAF'] as const).map((currency) => ({
      currency,
      method: 'card' as const,
      operators: [],
      contributorCountries: '*' as const,
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.methods],
    })),
    {
      currency: 'GHS',
      method: 'mobile_money',
      operators: ['mtn', 'telecel', 'airteltigo'],
      contributorCountries: ['GH'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.ghana],
      note: 'Network names differ between the overview and the parameters table (Telecel or VODAFONE, TIGO).',
    },
    {
      currency: 'UGX',
      method: 'mobile_money',
      operators: ['mtn', 'airtel'],
      contributorCountries: ['UG'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.uganda],
    },
    {
      currency: 'KES',
      method: 'mobile_money',
      operators: ['mpesa'],
      contributorCountries: ['KE'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.mpesa],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['mtn', 'orange_money', 'moov', 'wave'],
      contributorCountries: ['CI'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['orange_money', 'wave'],
      contributorCountries: ['SN'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['orange_money', 'mobicash'],
      contributorCountries: ['BF'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XAF',
      method: 'mobile_money',
      operators: ['mtn', 'orange_money'],
      contributorCountries: ['CM'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    ...(['RWF', 'TZS'] as const).map((currency) => ({
      currency,
      method: 'mobile_money' as const,
      operators: [],
      contributorCountries: '*' as const,
      minMinor: null,
      maxMinor: null,
      verified: false,
      sources: [FLUTTERWAVE.methods],
      note: 'Operators of the collections not documented.',
    })),
    ...(['EUR', 'GBP', 'USD'] as const).map((currency) => ({
      currency,
      method: 'card' as const,
      operators: [],
      contributorCountries: '*' as const,
      minMinor: null,
      maxMinor: null,
      verified: false,
      sources: [FLUTTERWAVE.methods, FLUTTERWAVE.split],
      note: 'Cards in this currency are documented, not the split into a subaccount settled in an African currency.',
    })),
  ],
  fees: [
    ...(['card', 'bank_transfer', 'bank_account', 'ussd'] as const).map((method) => ({
      payoutCountry: 'NG',
      method,
      currency: 'NGN',
      percentBps: 200,
      fixedMinor: 0n,
      vatOnFeeBps: 750,
      verified: true,
      sources: [FLUTTERWAVE.pricingNg],
    })),
  ],
  /**
   * Checked on 2026-10-10: a subaccount takes the bank code and number, « the country the bank
   * account is in », a business name and a business mobile number; the platform « is responsible
   * for thoroughly vetting the merchants » (split-payments), hence the manual review of the
   * identity by Pitchorium (ADR 0050), whose documents remain to set (open question 57).
   */
  eligibility: {
    requirements: [
      { code: 'bank_account_in_payout_country', scope: 'all' },
      { code: 'business_name', scope: 'all' },
      { code: 'phone_number', scope: 'all' },
    ],
    documents: [{ code: 'identity_document', scope: 'all' }],
    sources: [FLUTTERWAVE.split],
  },
};

/** Verified payout countries of the live rails, in matrix order. */
const LIVE_PAYOUT_COUNTRIES = [STRIPE_CAPABILITIES, FLUTTERWAVE_CAPABILITIES].flatMap(
  (capabilities) =>
    capabilities.payoutCountries.filter((entry) => entry.verified).map((entry) => entry.country),
);

/** Contributor countries where a live rail verified a mobile money collection. */
const LIVE_MOBILE_MONEY_COUNTRIES = [
  ...new Set(
    [STRIPE_CAPABILITIES, FLUTTERWAVE_CAPABILITIES].flatMap((capabilities) =>
      capabilities.payments.flatMap((payment) =>
        payment.verified &&
        payment.method === 'mobile_money' &&
        payment.contributorCountries !== '*'
          ? payment.contributorCountries
          : [],
      ),
    ),
  ),
];

/**
 * Simulated provider (ADR 0052): the payout countries the live rails verified, so that
 * development and tests show the coverage production has, each settled in EUR (the
 * demonstration projects are in EUR); the currencies of the demonstration and every method,
 * mobile money for the contributor countries where a live rail verified it. Refused in
 * production.
 */
export const SIMULATED_CAPABILITIES: ProviderCapabilities = {
  provider: 'simulated',
  onboarding: 'bank_details',
  kycMode: 'manual_review',
  paymentCurrencies: 'any',
  payoutCountries: LIVE_PAYOUT_COUNTRIES.map((country) => ({
    country,
    currency: 'EUR',
    verified: true,
    sources: [],
  })),
  payments: [
    ...(['EUR', 'XOF', 'XAF', 'NGN', 'GHS', 'KES'] as const).flatMap((currency) =>
      (['card', 'mobile_money', 'sepa_debit', 'bank_transfer'] as const)
        .filter((method) => method !== 'sepa_debit' || currency === 'EUR')
        .filter((method) => method !== 'mobile_money' || currency !== 'EUR')
        .map((method) => ({
          currency,
          method,
          operators: method === 'mobile_money' ? (['simulated_money'] as const) : [],
          contributorCountries:
            method === 'mobile_money' ? LIVE_MOBILE_MONEY_COUNTRIES : ('*' as const),
          minMinor: null,
          maxMinor: null,
          verified: true,
          sources: [],
        })),
    ),
  ],
  fees: [],
  /** Bank details and the manual review, like a subaccount (development and tests). */
  eligibility: {
    requirements: [{ code: 'bank_account_in_payout_country', scope: 'all' }],
    documents: [{ code: 'identity_document', scope: 'all' }],
    sources: [],
  },
};

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderCapabilities>> = {
  stripe: STRIPE_CAPABILITIES,
  flutterwave: FLUTTERWAVE_CAPABILITIES,
  simulated: SIMULATED_CAPABILITIES,
};
