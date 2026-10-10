import type { Contribution, PaymentCoverage, ProviderCoverage } from '@pitchorium/contracts';
import { PROJECT_PAYMENT_AVAILABILITIES } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { availabilityPresentation } from './availability';
import { payoutCountries, payoutOptions } from './coverage';
import { currentStep, journeySteps, neighbourStep } from './journey';
import { maskAccountNumber } from './masking';
import { availableMethods, unavailableMethods } from './methods';
import { lockExpired, resumableContribution, returnOutcome } from './status';

const eur = (amountMinor: string) => ({ amountMinor, currency: 'EUR' });

describe('availabilityPresentation', () => {
  it('has a presentation for every availability code of the api', () => {
    for (const code of PROJECT_PAYMENT_AVAILABILITIES) {
      expect(availabilityPresentation(code)).toBeDefined();
    }
  });

  it('offers the payment only when the contributions are open', () => {
    expect(
      PROJECT_PAYMENT_AVAILABILITIES.filter((code) => availabilityPresentation(code).pay),
    ).toEqual(['open']);
  });

  it('keeps the alternatives while the holder finishes their setup, never after the end', () => {
    expect(availabilityPresentation('holder_not_verified').alternatives).toBe(true);
    expect(availabilityPresentation('holder_without_covered_payout_account').alternatives).toBe(
      true,
    );
    expect(availabilityPresentation('campaign_closed')).toMatchObject({
      pay: false,
      alternatives: false,
    });
    // Frozen by the moderation: no payment, and not presented as closed either.
    expect(availabilityPresentation('funding_frozen')).toMatchObject({
      pay: false,
      alternatives: false,
    });
  });
});

describe('available and unavailable methods', () => {
  const currencies = [
    {
      currency: 'EUR',
      min: eur('100'),
      max: eur('1000000'),
      methods: [
        { method: 'card' as const, operators: [], min: eur('100'), max: eur('1000000') },
        { method: 'sepa_debit' as const, operators: [], min: eur('100'), max: eur('1000000') },
      ],
    },
  ];

  it('lists the methods of the currency shown, in the order of the api', () => {
    expect(availableMethods(currencies, 'EUR').map((entry) => entry.method)).toEqual([
      'card',
      'sepa_debit',
    ]);
    expect(availableMethods(currencies, 'XOF')).toEqual([]);
    expect(availableMethods(currencies, null)).toEqual([]);
  });

  it('keeps the first reason of each method and never contradicts an available one', () => {
    const available = availableMethods(currencies, 'EUR');
    expect(
      unavailableMethods(
        [
          { method: 'mobile_money', reason: 'contributor_country_not_covered' },
          { method: 'mobile_money', reason: 'currency_not_supported' },
          { method: 'card', reason: 'amount_out_of_range' },
          { method: 'paypal', reason: 'not_covered_by_holder_rail' },
        ],
        available,
      ),
    ).toEqual([
      { method: 'mobile_money', reason: 'contributor_country_not_covered' },
      { method: 'paypal', reason: 'not_covered_by_holder_rail' },
    ]);
  });
});

describe('journeySteps', () => {
  it('declares a love money commitment without amount nor payment', () => {
    expect(
      journeySteps({ kind: 'love_money_commitment', hasRewards: true, hasOrganizations: true }),
    ).toEqual(['kind', 'review']);
  });

  it('asks for a reward only for a reward funding with rewards, and a name only with organisations', () => {
    expect(journeySteps({ kind: 'donation', hasRewards: true, hasOrganizations: false })).toEqual([
      'kind',
      'country',
      'amount',
      'display',
      'method',
      'review',
    ]);
    expect(
      journeySteps({ kind: 'reward_crowdfunding', hasRewards: true, hasOrganizations: true }),
    ).toEqual(['kind', 'country', 'amount', 'reward', 'behalf', 'display', 'method', 'review']);
    expect(
      journeySteps({ kind: 'reward_crowdfunding', hasRewards: false, hasOrganizations: false }),
    ).not.toContain('reward');
  });

  it('reads a step from the address only when it belongs to the journey', () => {
    const steps = journeySteps({ kind: 'donation', hasRewards: false, hasOrganizations: false });
    expect(currentStep('method', steps)).toBe('method');
    expect(currentStep('reward', steps)).toBe('kind');
    expect(currentStep(null, steps)).toBe('kind');
    expect(neighbourStep(steps, 'kind', -1)).toBeNull();
    expect(neighbourStep(steps, 'display', 1)).toBe('method');
  });
});

describe('maskAccountNumber', () => {
  it('shows the last four characters only, spaces ignored', () => {
    expect(maskAccountNumber('0123 4567 8901')).toBe('••••••••8901');
    expect(maskAccountNumber('+2348012345678')).toBe('••••••••••5678');
  });

  it('hides a value too short to keep anything readable', () => {
    expect(maskAccountNumber('1234')).toBe('••••');
    expect(maskAccountNumber('')).toBe('');
  });
});

describe('return and resumption', () => {
  it('tells a final payment from a pending one and from an attempt to try again', () => {
    expect(returnOutcome('pending_payment')).toBe('pending');
    expect(returnOutcome('succeeded')).toBe('paid');
    expect(returnOutcome('partially_refunded')).toBe('paid');
    for (const status of ['failed', 'expired', 'canceled'] as const) {
      expect(returnOutcome(status)).toBe('unpaid');
    }
  });

  const contribution = (overrides: Partial<Contribution>): Contribution =>
    ({
      id: '01a00000-0000-7000-8000-000000000001',
      project: { id: 'p1', slug: 'p', title: 'P' },
      status: 'pending_payment',
      paymentUrl: 'https://pay.example/1',
      expiresAt: '2026-10-10T12:30:00.000Z',
      ...overrides,
    }) as Contribution;
  const now = Date.parse('2026-10-10T12:00:00.000Z');

  it('proposes again the pending contribution of this project whose session is still open', () => {
    const pending = contribution({});
    expect(resumableContribution([pending], 'p1', now)).toBe(pending);
    expect(resumableContribution([pending], 'p2', now)).toBeNull();
    expect(resumableContribution([contribution({ status: 'succeeded' })], 'p1', now)).toBeNull();
    expect(resumableContribution([contribution({ paymentUrl: null })], 'p1', now)).toBeNull();
  });

  it('treats a locked rate as expired from the end of its session', () => {
    const pending = contribution({});
    expect(lockExpired(pending, now)).toBe(false);
    expect(lockExpired(pending, Date.parse(pending.expiresAt))).toBe(true);
    expect(resumableContribution([pending], 'p1', Date.parse(pending.expiresAt))).toBeNull();
  });
});

describe('payout coverage', () => {
  const stripe: ProviderCoverage = {
    provider: 'stripe',
    onboarding: 'hosted',
    kycMode: 'provider',
    paymentCurrencyRule: 'payout_currency',
    payoutCountries: [
      { country: 'FR', currency: 'EUR' },
      { country: 'BE', currency: 'EUR' },
    ],
    payoutCurrencies: ['EUR'],
    paymentCurrencies: ['EUR'],
    payments: [
      {
        currency: 'EUR',
        method: 'card',
        operators: [],
        contributorCountries: null,
        min: eur('50'),
        max: null,
      },
    ],
    eligibility: { requirements: [], documents: [] },
  };
  const flutterwave: ProviderCoverage = {
    provider: 'flutterwave',
    onboarding: 'bank_details',
    kycMode: 'manual_review',
    paymentCurrencyRule: 'payout_currency',
    payoutCountries: [{ country: 'GH', currency: 'GHS' }],
    payoutCurrencies: ['GHS'],
    paymentCurrencies: ['GHS', 'NGN'],
    payments: [
      {
        currency: 'GHS',
        method: 'card',
        operators: [],
        contributorCountries: null,
        min: null,
        max: null,
      },
      {
        currency: 'GHS',
        method: 'mobile_money',
        operators: ['mtn', 'telecel'],
        contributorCountries: ['GH'],
        min: null,
        max: null,
      },
      {
        currency: 'NGN',
        method: 'ussd',
        operators: [],
        contributorCountries: ['NG'],
        min: null,
        max: null,
      },
    ],
    eligibility: { requirements: [], documents: [] },
  };
  const coverage: PaymentCoverage = {
    matrixVersion: '2026-10-10',
    verifiedAt: '2026-10-07',
    providers: [stripe, flutterwave],
  };

  it('lists every payout country once, in the order of the api', () => {
    expect(payoutCountries(coverage)).toEqual(['FR', 'BE', 'GH']);
  });

  it('gives the options of a country only, with no option for an uncovered one', () => {
    expect(payoutOptions(coverage, 'FR').map((option) => option.provider)).toEqual(['stripe']);
    expect(payoutOptions(coverage, 'SN')).toEqual([]);
  });

  it('applies the currency rule of the provider and says what the option does not cover', () => {
    const [ghana] = payoutOptions(coverage, 'GH');
    // A Ghanaian account settled in GHS: the NGN payments of the same provider do not reach it.
    expect(ghana!.methods.map((method) => [method.method, method.currency])).toEqual([
      ['card', 'GHS'],
      ['mobile_money', 'GHS'],
    ]);
    expect(ghana!.notCovered).toEqual([{ method: 'ussd', operators: [] }]);
    const [france] = payoutOptions(coverage, 'FR');
    expect(france!.notCovered).toEqual([
      { method: 'mobile_money', operators: ['mtn', 'telecel'] },
      { method: 'ussd', operators: [] },
    ]);
  });
});
