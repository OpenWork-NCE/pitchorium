import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_MATRIX_VERIFIED_AT,
  CAPABILITY_MATRIX_VERSION,
  FLUTTERWAVE_CAPABILITIES,
  STRIPE_CAPABILITIES,
} from './capability-matrix';
import { buildCoverage } from './coverage';

describe('public coverage', () => {
  const live = buildCoverage(['flutterwave', 'stripe']);
  const [stripe, flutterwave] = live.providers;

  it('lists the enabled providers in the order of the matrix, with its version', () => {
    expect(live.matrixVersion).toBe(CAPABILITY_MATRIX_VERSION);
    expect(live.verifiedAt).toBe(CAPABILITY_MATRIX_VERIFIED_AT);
    expect(live.providers.map((provider) => provider.provider)).toEqual(['stripe', 'flutterwave']);
    expect(buildCoverage(['simulated']).providers.map((provider) => provider.provider)).toEqual([
      'simulated',
    ]);
    expect(buildCoverage([]).providers).toEqual([]);
  });

  it('exposes the verified payout countries only, with their currency', () => {
    expect(stripe?.payoutCountries).toContainEqual({ country: 'FR', currency: 'EUR' });
    expect(stripe?.payoutCurrencies).toEqual(['EUR']);
    expect(flutterwave?.payoutCountries).toEqual([
      { country: 'NG', currency: 'NGN' },
      { country: 'GH', currency: 'GHS' },
      { country: 'RW', currency: 'RWF' },
      { country: 'TZ', currency: 'TZS' },
      { country: 'UG', currency: 'UGX' },
    ]);
    const countries = live.providers.flatMap((provider) =>
      provider.payoutCountries.map((entry) => entry.country),
    );
    for (const unverified of ['SN', 'CI', 'CM', 'KE', 'GB', 'CH', 'ZA']) {
      expect(countries).not.toContain(unverified);
    }
  });

  it('excludes a disabled capability and one no payout country can reach', () => {
    expect(stripe?.payments.map((payment) => payment.method)).toEqual([
      'card',
      'sepa_debit',
      'apple_pay',
      'google_pay',
    ]);
    // Payments in the payout currency only: the francophone mobile money is verified on the
    // collection side, but no XOF, XAF or KES payout country is.
    expect(flutterwave?.paymentCurrencyRule).toBe('payout_currency');
    expect(flutterwave?.paymentCurrencies).toEqual(['NGN', 'GHS', 'UGX', 'RWF', 'TZS']);
    expect(flutterwave?.payments.some((payment) => payment.currency === 'XOF')).toBe(false);
    expect(flutterwave?.payments.some((payment) => payment.currency === 'EUR')).toBe(false);
    for (const [coverage, matrix] of [
      [stripe, STRIPE_CAPABILITIES],
      [flutterwave, FLUTTERWAVE_CAPABILITIES],
    ] as const) {
      for (const payment of coverage?.payments ?? []) {
        expect(
          matrix.payments.find(
            (entry) =>
              entry.currency === payment.currency &&
              entry.method === payment.method &&
              entry.operators.join() === payment.operators.join(),
          )?.verified,
        ).toBe(true);
      }
    }
  });

  it('gives the contributor countries, operators and verified bounds of each payment', () => {
    expect(stripe?.payments[1]).toEqual({
      currency: 'EUR',
      method: 'sepa_debit',
      operators: [],
      contributorCountries: null,
      min: { amountMinor: '50', currency: 'EUR' },
      max: { amountMinor: '1000000', currency: 'EUR' },
    });
    expect(flutterwave?.payments).toContainEqual({
      currency: 'GHS',
      method: 'mobile_money',
      operators: ['mtn', 'telecel', 'airteltigo'],
      contributorCountries: ['GH'],
      min: null,
      max: null,
    });
  });

  it('says what each provider asks of a holder, as codes', () => {
    expect(stripe?.eligibility.requirements).toContainEqual({
      code: 'address_in_payout_country',
      scope: 'all',
    });
    expect(stripe?.eligibility.requirements).toContainEqual({
      code: 'company_registered_in_payout_country',
      scope: 'company',
    });
    expect(stripe?.eligibility.documents).toContainEqual({
      code: 'passport_if_resident_elsewhere',
      scope: 'all',
    });
    expect(flutterwave?.eligibility.requirements.map((entry) => entry.code)).toEqual([
      'bank_account_in_payout_country',
      'business_name',
      'phone_number',
    ]);
    expect(STRIPE_CAPABILITIES.eligibility.sources.length).toBeGreaterThan(0);
    expect(FLUTTERWAVE_CAPABILITIES.eligibility.sources.length).toBeGreaterThan(0);
  });
});
