import { describe, expect, it } from 'vitest';
import {
  type Bounds,
  closestReason,
  evaluatePayments,
  methodsByCurrency,
  offeredMethods,
  projectPaymentAvailability,
} from './payment-options';
import { payoutRoute } from './routing';

const live = ['stripe', 'flutterwave'] as const;
/** Wide platform bounds in every currency: only the provider bounds narrow them. */
const WIDE: Bounds = { minMinor: 1n, maxMinor: 10_000_000_000n };
const wide = () => WIDE;

function route(provider: 'stripe' | 'flutterwave' | 'simulated', country: string) {
  const found = payoutRoute(provider, country, provider === 'simulated' ? ['simulated'] : live);
  if (!found) throw new Error(`No route ${provider} ${country}`);
  return found;
}

const methodsOf = (evaluation: ReturnType<typeof evaluatePayments>) => [
  ...new Set(evaluation.available.map(({ capability }) => capability.method)),
];

describe('availability of the contributions of a project', () => {
  const open = { open: true, status: 'funding' as const };
  const ready = { covered: true, collecting: true };

  it('is open with a covered, active and verified holder', () => {
    expect(projectPaymentAvailability(open, ready)).toBe('open');
    expect(projectPaymentAvailability({ open: true, status: 'funded' }, ready)).toBe('open');
  });

  it('tells a holder without a covered account from a holder not verified yet', () => {
    expect(projectPaymentAvailability(open, { covered: false, collecting: false })).toBe(
      'holder_without_covered_payout_account',
    );
    expect(projectPaymentAvailability(open, { covered: true, collecting: false })).toBe(
      'holder_not_verified',
    );
  });

  it('tells a closed campaign from a funding frozen by the moderation, before the holder', () => {
    const nobody = { covered: false, collecting: false };
    expect(projectPaymentAvailability({ open: false, status: 'closed' }, nobody)).toBe(
      'campaign_closed',
    );
    expect(projectPaymentAvailability({ open: false, status: 'funding' }, ready)).toBe(
      'funding_frozen',
    );
  });
});

describe('payment methods for a contributor', () => {
  const offered = offeredMethods(live);

  it('evaluates the methods the active providers offer, PayPal never', () => {
    expect(offered).toEqual([
      'card',
      'sepa_debit',
      'apple_pay',
      'google_pay',
      'mobile_money',
      'bank_transfer',
      'bank_account',
      'ussd',
    ]);
    expect(offeredMethods(['simulated'])).toEqual([
      'card',
      'sepa_debit',
      'mobile_money',
      'bank_transfer',
    ]);
  });

  it('gives the methods of the rail of the holder, the others not covered by it', () => {
    const stripe = evaluatePayments(
      route('stripe', 'FR'),
      offered,
      { contributorCountry: 'SN' },
      wide,
    );
    expect(methodsOf(stripe)).toEqual(['card', 'sepa_debit', 'apple_pay', 'google_pay']);
    expect(stripe.unavailable).toEqual([
      { method: 'mobile_money', reason: 'not_covered_by_holder_rail' },
      { method: 'bank_transfer', reason: 'not_covered_by_holder_rail' },
      { method: 'bank_account', reason: 'not_covered_by_holder_rail' },
      { method: 'ussd', reason: 'not_covered_by_holder_rail' },
    ]);
    // A method no active provider offers is not covered either.
    expect(
      evaluatePayments(route('stripe', 'FR'), ['paypal'], { contributorCountry: 'FR' }, wide)
        .unavailable,
    ).toEqual([{ method: 'paypal', reason: 'not_covered_by_holder_rail' }]);
  });

  it('refuses a method of the rail that does not serve the country of the contributor', () => {
    const nigeria = route('flutterwave', 'NG');
    const fromFrance = evaluatePayments(nigeria, offered, { contributorCountry: 'FR' }, wide);
    expect(methodsOf(fromFrance)).toEqual(['card']);
    expect(fromFrance.unavailable).toContainEqual({
      method: 'ussd',
      reason: 'contributor_country_not_covered',
    });
    // The francophone mobile money is verified in XOF, never on a rail settled in naira.
    expect(fromFrance.unavailable).toContainEqual({
      method: 'mobile_money',
      reason: 'not_covered_by_holder_rail',
    });
    const fromNigeria = evaluatePayments(nigeria, offered, { contributorCountry: 'NG' }, wide);
    expect(methodsOf(fromNigeria)).toEqual(['card', 'bank_transfer', 'bank_account', 'ussd']);
    // Without a declared country, only the methods open to every country.
    expect(
      methodsOf(evaluatePayments(nigeria, offered, { contributorCountry: null }, wide)),
    ).toEqual(['card']);
  });

  it('refuses a method in a currency the rail does not take, or without a rate', () => {
    const simulated = route('simulated', 'FR');
    const inXof = evaluatePayments(
      simulated,
      ['sepa_debit', 'mobile_money'],
      { contributorCountry: 'SN', currency: 'XOF' },
      wide,
    );
    expect(inXof.unavailable).toEqual([{ method: 'sepa_debit', reason: 'currency_not_supported' }]);
    expect(methodsOf(inXof)).toEqual(['mobile_money']);
    const withoutRate = evaluatePayments(
      simulated,
      ['card'],
      { contributorCountry: 'SN', currency: 'NGN' },
      (currency) => (currency === 'NGN' ? null : WIDE),
    );
    expect(withoutRate.unavailable).toEqual([{ method: 'card', reason: 'currency_not_supported' }]);
    // The euro on the naira rail of Flutterwave is not covered by that rail at all.
    expect(
      evaluatePayments(
        route('flutterwave', 'NG'),
        ['card'],
        { contributorCountry: 'NG', currency: 'EUR' },
        wide,
      ).unavailable,
    ).toEqual([{ method: 'card', reason: 'currency_not_supported' }]);
  });

  it('refuses an amount outside the bounds of the platform narrowed by the provider', () => {
    const stripe = route('stripe', 'FR');
    const platform = (): Bounds => ({ minMinor: 100n, maxMinor: 1_000_000n });
    const large = evaluatePayments(
      stripe,
      ['card', 'sepa_debit'],
      { contributorCountry: 'FR', currency: 'EUR', amountMinor: 1_000_001n },
      platform,
    );
    expect(large.unavailable).toEqual([
      { method: 'card', reason: 'amount_out_of_range' },
      { method: 'sepa_debit', reason: 'amount_out_of_range' },
    ]);
    // SEPA stops at 10,000 EUR (provider), the card goes up to the platform bound.
    const wider = (): Bounds => ({ minMinor: 100n, maxMinor: 2_000_000n });
    const big = evaluatePayments(
      stripe,
      ['card', 'sepa_debit'],
      { contributorCountry: 'FR', currency: 'EUR', amountMinor: 1_500_000n },
      wider,
    );
    expect(methodsOf(big)).toEqual(['card']);
    expect(big.unavailable).toEqual([{ method: 'sepa_debit', reason: 'amount_out_of_range' }]);
    // The minimum is the larger of the platform and provider minimums (0.50 EUR at Stripe).
    const small = evaluatePayments(
      stripe,
      ['card'],
      { contributorCountry: 'FR', currency: 'EUR', amountMinor: 40n },
      () => ({ minMinor: 1n, maxMinor: 100n }),
    );
    expect(small.unavailable).toEqual([{ method: 'card', reason: 'amount_out_of_range' }]);
    expect(
      methodsByCurrency(
        evaluatePayments(stripe, ['card', 'sepa_debit'], { contributorCountry: 'FR' }, wider)
          .available,
      ).get('EUR'),
    ).toEqual([
      { method: 'card', operators: [], bounds: { minMinor: 100n, maxMinor: 2_000_000n } },
      { method: 'sepa_debit', operators: [], bounds: { minMinor: 100n, maxMinor: 1_000_000n } },
    ]);
  });

  it('tells the reason of the method that came closest when none takes a request', () => {
    const stripe = route('stripe', 'FR');
    const evaluation = evaluatePayments(
      stripe,
      offered,
      { contributorCountry: 'FR', currency: 'EUR', amountMinor: 1n },
      () => ({ minMinor: 100n, maxMinor: 1_000n }),
    );
    expect(evaluation.available).toEqual([]);
    expect(closestReason(evaluation)).toBe('amount_out_of_range');
    expect(
      closestReason(
        evaluatePayments(stripe, offered, { contributorCountry: 'FR', currency: 'XOF' }, wide),
      ),
    ).toBe('currency_not_supported');
    expect(closestReason({ available: [], unavailable: [] })).toBe('not_covered_by_holder_rail');
  });

  it('offers the simulated mobile money where a live rail verified it only', () => {
    const simulated = route('simulated', 'FR');
    expect(
      methodsOf(evaluatePayments(simulated, ['mobile_money'], { contributorCountry: 'SN' }, wide)),
    ).toEqual(['mobile_money']);
    expect(
      evaluatePayments(simulated, ['mobile_money'], { contributorCountry: 'FR' }, wide).unavailable,
    ).toEqual([{ method: 'mobile_money', reason: 'contributor_country_not_covered' }]);
  });
});
