import { CONTRIBUTION_STATUSES, type ContributionStatus } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError, Money } from '../../../platform/kernel';
import {
  FLUTTERWAVE_CAPABILITIES,
  PROVIDER_CAPABILITIES,
  STRIPE_CAPABILITIES,
} from './capability-matrix';
import { commissionOn, commissionRefundFor, eurPartFor } from './commission';
import { assertCollectible, assertTransition, canTransition } from './contribution';
import { eurEquivalent, fixedParityOf, fixedRate, smallestAmountReaching } from './fx';
import {
  assertBalanced,
  balances,
  disputeLost,
  disputeOpened,
  disputeWon,
  LEDGER_ACCOUNTS,
  offlineValidated,
  paymentSucceeded,
  providerFeeRecorded,
  refundSucceeded,
  UnbalancedLedgerEntryError,
} from './ledger';
import { assertWithinBounds, buildQuote } from './quote';
import { payoutChangeRefusal } from './payout';
import { availablePayments, estimateFee, isCovered, payoutRoute, requirePayment } from './routing';

const AT = new Date('2026-10-07T10:00:00.000Z');
const eur = (minor: bigint) => Money.of(minor, 'EUR');
const xof = (minor: bigint) => Money.of(minor, 'XOF');
const PARITY = fixedRate('XOF', AT);
const TERMS = { rateBps: 500, version: 'test' };

const codeOf = (work: () => unknown): string | undefined => {
  try {
    work();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
  return undefined;
};

describe('conversion to the EUR equivalent', () => {
  it('applies the fixed parity of the CFA francs exactly, halves up to the cent', () => {
    if (!PARITY) throw new Error('No parity');
    expect(PARITY).toMatchObject({ unitsPerEur: '655.957', source: 'fixed_parity' });
    expect(fixedRate('XAF', AT)).toMatchObject({ unitsPerEur: '655.957' });
    expect(eurEquivalent(xof(655_957n), PARITY)).toEqual(eur(100_000n));
    // 65 596 / 655.957 = 100.0006... EUR.
    expect(eurEquivalent(xof(65_596n), PARITY)).toEqual(eur(10_000n));
    // 3 XOF = 0.457 cent, 4 XOF = 0.609 cent.
    expect(eurEquivalent(xof(3n), PARITY)).toEqual(eur(0n));
    expect(eurEquivalent(xof(4n), PARITY)).toEqual(eur(1n));
    expect(eurEquivalent(Money.of(65_596n, 'XAF'), PARITY)).toEqual(eur(10_000n));
  });

  it('gives the CFA franc of a country of the UEMOA or of the CEMAC, none for another', () => {
    expect(fixedParityOf('SN')).toEqual({ currency: 'XOF', unitsPerEur: '655.957' });
    expect(fixedParityOf('GW')).toEqual({ currency: 'XOF', unitsPerEur: '655.957' });
    expect(fixedParityOf('CM')).toEqual({ currency: 'XAF', unitsPerEur: '655.957' });
    expect(fixedParityOf('GQ')).toEqual({ currency: 'XAF', unitsPerEur: '655.957' });
    // Comoros: another franc, another parity; Ghana and France: no fixed parity to the euro.
    for (const country of ['KM', 'GH', 'FR', null]) expect(fixedParityOf(country)).toBeNull();
  });

  it('keeps euros as they are and refuses an unknown rate', () => {
    const identity = fixedRate('EUR', AT);
    expect(identity).toMatchObject({ unitsPerEur: '1', source: 'identity' });
    expect(fixedRate('NGN', AT)).toBeNull();
    expect(eurEquivalent(eur(1099n), { unitsPerEur: '1', source: 'identity', at: AT })).toEqual(
      eur(1099n),
    );
  });

  it('converts a floating currency with a decimal rate, without float', () => {
    // 1 EUR = 1612.345 NGN: 161 234.50 NGN = 100.00 EUR.
    const rate = { unitsPerEur: '1612.345', source: 'provider' as const, at: AT };
    expect(eurEquivalent(Money.of(16_123_450n, 'NGN'), rate)).toEqual(eur(10_000n));
    expect(() => eurEquivalent(Money.of(1n, 'NGN'), { ...rate, unitsPerEur: '0' })).toThrow(
      DomainError,
    );
    expect(() => eurEquivalent(Money.of(1n, 'NGN'), { ...rate, unitsPerEur: '1e3' })).toThrow(
      DomainError,
    );
  });

  it('finds the smallest amount of a currency reaching an EUR amount', () => {
    if (!PARITY) throw new Error('No parity');
    const target = eur(10_000n);
    const smallest = smallestAmountReaching(target, 'XOF', PARITY);
    expect(eurEquivalent(smallest, PARITY).compare(target)).toBeGreaterThanOrEqual(0);
    expect(eurEquivalent(smallest.subtract(xof(1n)), PARITY).compare(target)).toBe(-1);
    expect(smallestAmountReaching(target, 'EUR', PARITY)).toEqual(target);
  });
});

describe('commission', () => {
  it('takes 5 % of the amount, rounded down in favour of the holder', () => {
    expect(commissionOn(eur(1099n), TERMS)).toEqual(eur(54n));
    expect(commissionOn(xof(65_596n), TERMS)).toEqual(xof(3279n));
    expect(commissionOn(eur(10_000n), TERMS)).toEqual(eur(500n));
    expect(commissionOn(eur(19n), TERMS)).toEqual(eur(0n));
  });

  it('refunds the commission in proportion, rounded up, the parts summing to the whole', () => {
    const first = commissionRefundFor(54n, 1099n, 0n, 500n);
    const rest = commissionRefundFor(54n, 1099n, 500n, 599n);
    expect(first).toBe(25n);
    expect(first + rest).toBe(54n);
  });

  it('follows refunds with their EUR part, rounded down, the last part giving the rest', () => {
    expect(eurPartFor(10_000n, 65_596n, 0n, 32_798n)).toBe(5000n);
    expect(eurPartFor(10_000n, 65_596n, 32_798n, 32_798n)).toBe(5000n);
    const parts = [0n, 1n, 2n].map((before) => eurPartFor(100n, 3n, before, 1n));
    expect(parts).toEqual([33n, 33n, 34n]);
  });
});

describe('quote', () => {
  const rate = { unitsPerEur: '1', source: 'identity' as const, at: AT };
  const reward = {
    id: 'reward-1',
    minAmount: eur(2400n),
    instruments: ['reward_crowdfunding'] as const,
    available: 1,
  };

  it('shows the amount, the commission, the estimated fee and the estimated holder amount', () => {
    const quote = buildQuote({
      kind: 'reward_crowdfunding',
      amount: eur(10_000n),
      rate,
      terms: TERMS,
      estimatedFee: eur(175n),
      reward,
    });
    expect(quote.commission).toEqual(eur(500n));
    expect(quote.estimatedHolderAmount).toEqual(eur(9325n));
    expect(quote.reward).toEqual({
      rewardId: 'reward-1',
      minAmount: eur(2400n),
      eligible: true,
      soldOut: false,
    });
  });

  it('compares the reward minimum with the EUR equivalent, and refuses love money', () => {
    if (!PARITY) throw new Error('No parity');
    const below = buildQuote({
      kind: 'reward_crowdfunding',
      amount: xof(15_000n),
      rate: PARITY,
      terms: TERMS,
      estimatedFee: null,
      reward,
    });
    expect(below.eurEquivalent).toEqual(eur(2287n));
    expect(below.reward?.eligible).toBe(false);
    expect(below.estimatedHolderAmount).toBeNull();
    const love = buildQuote({
      kind: 'love_money',
      amount: eur(5000n),
      rate,
      terms: TERMS,
      estimatedFee: null,
      reward,
    });
    expect(love.reward?.eligible).toBe(false);
    const soldOut = buildQuote({
      kind: 'reward_crowdfunding',
      amount: eur(5000n),
      rate,
      terms: TERMS,
      estimatedFee: null,
      reward: { ...reward, available: 0 },
    });
    expect(soldOut.reward).toMatchObject({ eligible: false, soldOut: true });
  });

  it('checks the platform bounds on the EUR equivalent and the provider bounds', () => {
    const quote = buildQuote({
      kind: 'donation',
      amount: eur(40n),
      rate,
      terms: TERMS,
      estimatedFee: null,
      reward: null,
    });
    const bounds = {
      minEur: eur(1n),
      maxEur: eur(1_000_000n),
      providerMinMinor: 50n,
      providerMaxMinor: null,
    };
    expect(codeOf(() => assertWithinBounds(quote, bounds))).toBe('PAYMENTS_AMOUNT_OUT_OF_RANGE');
    expect(
      codeOf(() => assertWithinBounds(quote, { ...bounds, providerMinMinor: null })),
    ).toBeUndefined();
    expect(
      codeOf(() =>
        assertWithinBounds(quote, { ...bounds, maxEur: eur(10n), providerMinMinor: null }),
      ),
    ).toBe('PAYMENTS_AMOUNT_OUT_OF_RANGE');
  });
});

describe('state machine of a contribution', () => {
  const allowed: Record<ContributionStatus, ContributionStatus[]> = {
    pending_payment: ['succeeded', 'failed', 'expired', 'canceled'],
    succeeded: ['partially_refunded', 'refunded', 'disputed'],
    partially_refunded: ['partially_refunded', 'refunded', 'disputed'],
    disputed: ['dispute_won', 'dispute_lost'],
    dispute_won: ['partially_refunded', 'refunded', 'disputed'],
    dispute_lost: [],
    failed: [],
    expired: [],
    canceled: [],
    refunded: [],
  };

  it.each(CONTRIBUTION_STATUSES.map((from) => [from] as const))('from %s', (from) => {
    for (const to of CONTRIBUTION_STATUSES) {
      expect(canTransition(from, to), `${from} to ${to}`).toBe(allowed[from].includes(to));
    }
  });

  it('refuses an invalid transition with a stable code', () => {
    expect(codeOf(() => assertTransition('refunded', 'succeeded'))).toBe(
      'PAYMENTS_INVALID_TRANSITION',
    );
    expect(codeOf(() => assertTransition('pending_payment', 'succeeded'))).toBeUndefined();
  });
});

describe('collected instruments', () => {
  it('collects donations, rewards crowdfunding and love money only', () => {
    expect(assertCollectible('donation')).toBe('donation');
    expect(assertCollectible('reward_crowdfunding')).toBe('reward_crowdfunding');
    expect(assertCollectible('love_money')).toBe('love_money');
  });

  it('refuses equity and loans whatever the feature flags, and the other instruments', () => {
    expect(codeOf(() => assertCollectible('equity'))).toBe('PAYMENTS_LICENSED_PARTNER_REQUIRED');
    expect(codeOf(() => assertCollectible('loan'))).toBe('PAYMENTS_LICENSED_PARTNER_REQUIRED');
    for (const kind of ['grant', 'honor_loan', 'convertible_bonds'] as const) {
      expect(codeOf(() => assertCollectible(kind))).toBe('PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE');
    }
  });
});

describe('ledger', () => {
  const contribution = {
    id: 'c-1',
    projectId: 'p-1',
    currency: 'XOF',
    amountMinor: 65_596n,
    commissionMinor: 3279n,
    eurMinor: 10_000n,
  };
  const base = { occurredAt: AT };
  const sumOf = (
    account: string,
    currency: string,
    lines: { account: string; currency: string; amountMinor: bigint }[],
  ) =>
    lines
      .filter((line) => line.account === account && line.currency === currency)
      .reduce((sum, line) => sum + line.amountMinor, 0n);

  it('balances every kind of entry per currency', () => {
    const opening = {
      ...disputeOpened(contribution, { id: 'd-1', amountMinor: 1000n }, base),
      id: 'e-1',
    };
    const entries = [
      paymentSucceeded(contribution, 120n, base),
      providerFeeRecorded(contribution, 30n, base),
      refundSucceeded(
        contribution,
        { id: 'r-1', amountMinor: 32_798n, commissionMinor: 1640n, eurMinor: 5000n },
        base,
      ),
      opening,
      disputeWon(opening, 'd-1', base),
      disputeLost(contribution, { id: 'd-1', eurMinor: 152n }, base),
      offlineValidated(
        { id: 'o-1', projectId: 'p-1', amountMinor: 50_000n, currency: 'EUR', eurMinor: 50_000n },
        base,
      ),
    ];
    for (const entry of entries) {
      expect(() => assertBalanced(entry)).not.toThrow();
      for (const sum of balances(entry.lines).values()) expect(sum).toBe(0n);
    }
    const all = entries.flatMap((entry) => entry.lines);
    for (const sum of balances(all).values()) expect(sum).toBe(0n);
    // EUR memo: what the project collected.
    expect(sumOf(LEDGER_ACCOUNTS.projectFunding, 'EUR', all)).toBe(
      10_000n - 5000n - 152n + 50_000n,
    );
    // The dispute won cancels its opening line by line.
    expect(entries[4]?.reversesEntryId).toBe('e-1');
    expect(sumOf(LEDGER_ACCOUNTS.disputes, 'XOF', all)).toBe(0n);
  });

  it('splits a payment between the holder, the commission and the fees', () => {
    const lines = paymentSucceeded(contribution, 120n, base).lines;
    expect(sumOf(LEDGER_ACCOUNTS.holderShare, 'XOF', lines)).toBe(65_596n - 3279n - 120n);
    expect(sumOf(LEDGER_ACCOUNTS.contributorFunds, 'XOF', lines)).toBe(-65_596n);
    // Zero lines are left out.
    expect(
      paymentSucceeded(contribution, 0n, base).lines.map((line) => line.account),
    ).not.toContain(LEDGER_ACCOUNTS.providerFees);
  });

  it('refuses an unbalanced entry', () => {
    expect(() =>
      assertBalanced({
        kind: 'refund',
        lines: [{ account: LEDGER_ACCOUNTS.refunds, currency: 'EUR', amountMinor: 1n }],
      }),
    ).toThrow(UnbalancedLedgerEntryError);
  });
});

describe('routing and capabilities', () => {
  const live = ['stripe', 'flutterwave'] as const;

  it('routes by the provider and the payout country the holder chose, verified only', () => {
    expect(payoutRoute('stripe', 'FR', live)).toEqual({
      provider: 'stripe',
      country: 'FR',
      currency: 'EUR',
    });
    expect(payoutRoute('flutterwave', 'NG', live)).toEqual({
      provider: 'flutterwave',
      country: 'NG',
      currency: 'NGN',
    });
    // The route takes the option chosen, nothing else: a holder living in Senegal, where no rail
    // is verified, collects through the account they hold in France.
    expect(payoutRoute('stripe', 'FR', live)?.country).toBe('FR');
    // A provider serves its own verified countries only, and only when enabled.
    expect(payoutRoute('flutterwave', 'FR', live)).toBeNull();
    expect(payoutRoute('stripe', 'NG', live)).toBeNull();
    expect(payoutRoute('flutterwave', 'NG', ['stripe'])).toBeNull();
    // Not verified anywhere: no route rather than a guess.
    expect(payoutRoute('stripe', 'SN', live)).toBeNull();
    expect(payoutRoute('flutterwave', 'SN', live)).toBeNull();
    expect(payoutRoute('stripe', 'GB', live)).toBeNull();
    // The simulated provider serves the payout countries of the live rails, in EUR.
    expect(payoutRoute('simulated', 'SN', ['simulated'])).toBeNull();
    expect(payoutRoute('simulated', 'FR', ['simulated'])).toEqual({
      provider: 'simulated',
      country: 'FR',
      currency: 'EUR',
    });
    expect(payoutRoute('simulated', 'NG', ['simulated'])).toEqual({
      provider: 'simulated',
      country: 'NG',
      currency: 'EUR',
    });
    expect(payoutRoute('stripe', 'FR', ['simulated'])).toBeNull();
  });

  it('tells whether an existing payout account is still covered', () => {
    const account = { provider: 'stripe' as const, country: 'FR', currency: 'EUR' };
    expect(isCovered(account, live)).toBe(true);
    expect(isCovered({ ...account, country: 'SN' }, live)).toBe(false);
    expect(isCovered({ ...account, currency: 'XOF' }, live)).toBe(false);
    expect(isCovered(account, ['flutterwave'])).toBe(false);
  });

  it('offers simulated mobile money where a live rail verified it only', () => {
    const route = payoutRoute('simulated', 'FR', ['simulated']);
    if (!route) throw new Error('No route');
    const methods = (country: string) =>
      new Set(availablePayments(route, country).map((payment) => payment.method));
    expect(methods('SN').has('mobile_money')).toBe(true);
    expect(methods('FR').has('mobile_money')).toBe(false);
    expect(methods('FR').has('card')).toBe(true);
  });

  it('offers only the verified methods for this contributor and this route', () => {
    const stripe = payoutRoute('stripe', 'FR', live);
    const flutterwave = payoutRoute('flutterwave', 'NG', live);
    if (!stripe || !flutterwave) throw new Error('No route');
    expect(availablePayments(stripe, 'SN').map((payment) => payment.method)).toEqual([
      'card',
      'sepa_debit',
      'apple_pay',
      'google_pay',
    ]);
    expect(availablePayments(flutterwave, 'FR').map((payment) => payment.method)).toEqual(['card']);
    expect(availablePayments(flutterwave, 'NG').map((payment) => payment.method)).toEqual([
      'card',
      'bank_transfer',
      'bank_account',
      'ussd',
    ]);
    // Payments on the Flutterwave route are in the currency of the payout account only.
    expect(
      availablePayments(flutterwave, 'KE').every((payment) => payment.currency === 'NGN'),
    ).toBe(true);
    expect(requirePayment(stripe, null, 'EUR', 'card').method).toBe('card');
    expect(codeOf(() => requirePayment(stripe, null, 'EUR', 'paypal'))).toBe(
      'PAYMENTS_METHOD_NOT_AVAILABLE',
    );
    expect(codeOf(() => requirePayment(flutterwave, 'NG', 'EUR', 'card'))).toBe(
      'PAYMENTS_CURRENCY_NOT_AVAILABLE',
    );
  });

  it('estimates fees from verified schedules only', () => {
    expect(estimateFee(STRIPE_CAPABILITIES, 'FR', 'card', eur(10_000n))).toEqual(eur(175n));
    expect(estimateFee(STRIPE_CAPABILITIES, 'FR', 'sepa_debit', eur(10_000n))).toEqual(eur(35n));
    expect(estimateFee(STRIPE_CAPABILITIES, 'DE', 'card', eur(10_000n))).toBeNull();
    expect(
      estimateFee(FLUTTERWAVE_CAPABILITIES, 'NG', 'card', Money.of(1_000_000n, 'NGN')),
    ).toEqual(Money.of(21_500n, 'NGN'));
  });

  it('gives a source to every verified capability', () => {
    for (const capabilities of [STRIPE_CAPABILITIES, FLUTTERWAVE_CAPABILITIES]) {
      for (const entry of [
        ...capabilities.payoutCountries,
        ...capabilities.payments,
        ...capabilities.fees,
      ]) {
        if (entry.verified) expect(entry.sources.length).toBeGreaterThan(0);
      }
    }
    expect(PROVIDER_CAPABILITIES.simulated.payoutCountries.map((entry) => entry.country)).toEqual(
      [STRIPE_CAPABILITIES, FLUTTERWAVE_CAPABILITIES].flatMap((capabilities) =>
        capabilities.payoutCountries
          .filter((entry) => entry.verified)
          .map((entry) => entry.country),
      ),
    );
  });
});

describe('change of the payout option', () => {
  const facts = {
    current: { provider: 'stripe', country: 'FR' },
    collecting: true,
    campaignInProgress: false,
    paymentsPending: false,
  };

  it('allows another option when no campaign collects and no payment is pending', () => {
    expect(payoutChangeRefusal(facts, { provider: 'flutterwave', country: 'NG' })).toBeNull();
    expect(payoutChangeRefusal(facts, { provider: 'stripe', country: 'BE' })).toBeNull();
    expect(payoutChangeRefusal(facts)).toBeNull();
  });

  it('refuses the current option, whatever the state', () => {
    expect(payoutChangeRefusal(facts, { provider: 'stripe', country: 'FR' })).toBe('same_option');
    expect(
      payoutChangeRefusal(
        { ...facts, campaignInProgress: true },
        { provider: 'stripe', country: 'FR' },
      ),
    ).toBe('same_option');
  });

  it('refuses while a campaign collects on the current account', () => {
    const during = { ...facts, campaignInProgress: true };
    expect(payoutChangeRefusal(during, { provider: 'flutterwave', country: 'NG' })).toBe(
      'campaign_in_progress',
    );
    expect(payoutChangeRefusal(during)).toBe('campaign_in_progress');
    // An account that no longer collects (not covered, restricted, KYC missing) may change.
    expect(
      payoutChangeRefusal(
        { ...during, collecting: false },
        { provider: 'flutterwave', country: 'NG' },
      ),
    ).toBeNull();
  });

  it('refuses while payments are pending on the current account', () => {
    expect(
      payoutChangeRefusal(
        { ...facts, paymentsPending: true },
        { provider: 'stripe', country: 'BE' },
      ),
    ).toBe('payments_pending');
    expect(
      payoutChangeRefusal(
        { ...facts, collecting: false, campaignInProgress: true, paymentsPending: true },
        { provider: 'stripe', country: 'BE' },
      ),
    ).toBe('payments_pending');
  });
});
