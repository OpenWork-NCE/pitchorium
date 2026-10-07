import type { PaymentMethod } from '@pitchorium/contracts';

/**
 * Capabilities of the payment providers (section 9.2), as configuration data. Every entry gives
 * the official documentation it was checked against on the date below; an entry whose
 * capability could not be confirmed there is `verified: false` and never offered (ADR 0043).
 * Changing an entry means checking the source again and bumping the version.
 */
export const CAPABILITY_MATRIX_VERSION = '2026-10-07';

export type ProviderId = 'stripe' | 'flutterwave' | 'simulated';

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
  operators: readonly string[];
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
  payoutCountries: readonly PayoutCountryCapability[] | '*';
  payments: readonly PaymentCapability[];
  fees: readonly FeeSchedule[];
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
      operators: ['MTN', 'Telecel', 'AirtelTigo'],
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
      operators: ['MTN', 'Airtel'],
      contributorCountries: ['UG'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.uganda],
    },
    {
      currency: 'KES',
      method: 'mobile_money',
      operators: ['M-Pesa'],
      contributorCountries: ['KE'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.mpesa],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['MTN', 'Orange Money', 'Moov', 'Wave'],
      contributorCountries: ['CI'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['Orange Money', 'Wave'],
      contributorCountries: ['SN'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XOF',
      method: 'mobile_money',
      operators: ['Orange Money', 'Mobicash'],
      contributorCountries: ['BF'],
      minMinor: null,
      maxMinor: null,
      verified: true,
      sources: [FLUTTERWAVE.francophone],
    },
    {
      currency: 'XAF',
      method: 'mobile_money',
      operators: ['MTN', 'Orange Money'],
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
};

/**
 * Simulated provider (ADR 0052): every country, the currencies of the demonstration and every
 * method, so that development and tests exercise all the paths. Refused in production.
 */
export const SIMULATED_CAPABILITIES: ProviderCapabilities = {
  provider: 'simulated',
  onboarding: 'bank_details',
  kycMode: 'manual_review',
  paymentCurrencies: 'any',
  payoutCountries: '*',
  payments: [
    ...(['EUR', 'XOF', 'XAF', 'NGN', 'GHS', 'KES'] as const).flatMap((currency) =>
      (['card', 'mobile_money', 'sepa_debit', 'bank_transfer'] as const)
        .filter((method) => method !== 'sepa_debit' || currency === 'EUR')
        .filter((method) => method !== 'mobile_money' || currency !== 'EUR')
        .map((method) => ({
          currency,
          method,
          operators: method === 'mobile_money' ? ['Simulated Money'] : [],
          contributorCountries: '*' as const,
          minMinor: null,
          maxMinor: null,
          verified: true,
          sources: [],
        })),
    ),
  ],
  fees: [],
};

export const PROVIDER_CAPABILITIES: Readonly<Record<ProviderId, ProviderCapabilities>> = {
  stripe: STRIPE_CAPABILITIES,
  flutterwave: FLUTTERWAVE_CAPABILITIES,
  simulated: SIMULATED_CAPABILITIES,
};
