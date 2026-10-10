import { Inject, Injectable } from '@nestjs/common';
import {
  type ContributionKind,
  type ContributionQuote,
  type ContributionRequestKind,
  type IndicativeCurrency,
  type PaymentMethod,
  type PaymentMethodOption,
  type PaymentOptions,
  type PaymentOptionsQuery,
  type ProjectPaymentAvailability,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Clock, DomainError, Money } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { type FundableProject, ProjectsFacade } from '../../projects';
import { type PaymentCapability, PROVIDER_CAPABILITIES } from '../domain/capability-matrix';
import { assertCollectible } from '../domain/contribution';
import { enabledCapabilities } from '../domain/coverage';
import { EUR, eurEquivalent, fixedParityOf, type Rate, smallestAmountReaching } from '../domain/fx';
import {
  type Bounds,
  closestReason,
  evaluatePayments,
  type MethodOption,
  methodsByCurrency,
  offeredMethods,
  type PaymentEvaluation,
  type PaymentRequest,
  projectPaymentAvailability,
} from '../domain/payment-options';
import type { PayoutAccountRecord } from '../domain/payout';
import { assertWithinBounds, buildQuote, type Quote, type RewardTerms } from '../domain/quote';
import { estimateFee, type PayoutRoute } from '../domain/routing';
import { PayoutService } from './payout.service';
import { FxRateProvider, PaymentProviders } from './ports';

/** Where a contribution to a project stands before paying. */
export interface PaymentContext {
  project: FundableProject;
  account: PayoutAccountRecord | null;
  /** The rail of the project, when the holder has a covered payout account. */
  route: PayoutRoute | null;
  contributorCountry: string | null;
  availability: ProjectPaymentAvailability;
}

export interface PreparedContribution {
  context: PaymentContext & { account: PayoutAccountRecord; route: PayoutRoute };
  quote: Quote;
  payment: PaymentCapability;
  /** Every method offered, evaluated for this currency and amount. */
  evaluation: PaymentEvaluation;
}

const projectNotFound = () => new DomainError('PROJECTS_NOT_FOUND', 'Project not found');

/**
 * Payment options and quotes (section 9.3 steps 1 to 3 and 7): the availability of the project,
 * the methods available to this contributor and the reason of the others (ADR 0135), the EUR
 * equivalent, the commission and the estimated fees. Options, quotes and contributions decide
 * with the same evaluation, so a method listed as unavailable is refused with the same reason.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly projects: ProjectsFacade,
    private readonly profiles: ProfilesFacade,
    private readonly payout: PayoutService,
    private readonly providers: PaymentProviders,
    private readonly fx: FxRateProvider,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async context(
    projectId: string,
    contributorId: string,
    country: string | undefined,
  ): Promise<PaymentContext> {
    const project = await this.projects.fundable(projectId);
    if (!project?.showable) throw projectNotFound();
    const holder = await this.payout.holderState(project.ownerId);
    const route =
      holder.covered && holder.account
        ? {
            provider: holder.account.provider,
            country: holder.account.country,
            currency: holder.account.currency,
          }
        : null;
    return {
      project,
      account: holder.account,
      route,
      contributorCountry: country ?? (await this.profiles.countryOf(contributorId)),
      availability: projectPaymentAvailability(project, holder),
    };
  }

  /**
   * The CFA franc in which a member may read amounts as an indicative equivalent, from the
   * country of their profile (ADR 0130).
   */
  async indicativeCurrency(userId: string): Promise<IndicativeCurrency> {
    const country = await this.profiles.countryOf(userId);
    return { country, fixedParity: fixedParityOf(country) };
  }

  async options(
    projectId: string,
    contributorId: string,
    query: PaymentOptionsQuery,
  ): Promise<PaymentOptions> {
    const context = await this.context(projectId, contributorId, query.country);
    const { route } = context;
    const base = {
      projectId,
      availability: context.availability,
      rail: route
        ? { provider: route.provider, payoutCountry: route.country, payoutCurrency: route.currency }
        : null,
      contributorCountry: context.contributorCountry,
      kinds: collectedKinds(context.project),
      commissionRateBps: this.config.payments.commission.rateBps,
      anonymousDonations: this.config.payments.anonymousDonations,
    };
    if (context.availability !== 'open' || !route) {
      return { ...base, acceptsPayments: false, currencies: [], unavailableMethods: [] };
    }
    const { evaluation } = await this.evaluate(route, offeredMethods(this.providers.enabled()), {
      contributorCountry: context.contributorCountry,
      currency: query.currency,
      amountMinor: query.amountMinor === undefined ? undefined : BigInt(query.amountMinor),
    });
    const currencies = [...methodsByCurrency(evaluation.available)].map(([currency, methods]) => ({
      currency,
      min: Money.of(
        methods.reduce(
          (min, { bounds }) => (bounds.minMinor < min ? bounds.minMinor : min),
          methods[0]?.bounds.minMinor ?? 0n,
        ),
        currency,
      ).toJSON(),
      max: Money.of(
        methods.reduce((max, { bounds }) => (bounds.maxMinor > max ? bounds.maxMinor : max), 0n),
        currency,
      ).toJSON(),
      methods: methods.map((method) => methodOption(method, currency)),
    }));
    return {
      ...base,
      acceptsPayments: currencies.length > 0,
      currencies,
      unavailableMethods: evaluation.unavailable,
    };
  }

  async quote(
    projectId: string,
    contributorId: string,
    request: {
      kind: ContributionRequestKind;
      amount: { amountMinor: string; currency: string };
      rewardId?: string | undefined;
      method?: PaymentMethod | undefined;
      country?: string | undefined;
    },
  ): Promise<ContributionQuote> {
    const prepared = await this.prepare(projectId, contributorId, request);
    const currency = prepared.quote.amount.currency;
    return quoteView(
      prepared.quote,
      (methodsByCurrency(prepared.evaluation.available).get(currency) ?? []).map((method) =>
        methodOption(method, currency),
      ),
    );
  }

  /**
   * Every check before a payment: collected kind accepted by the project, its availability, then
   * the method for this contributor, currency and amount (the reason of a refusal is the one the
   * options give), rate, bounds and reward. The rate returned is the one the session locks.
   */
  async prepare(
    projectId: string,
    contributorId: string,
    request: {
      kind: ContributionRequestKind;
      amount: { amountMinor: string; currency: string };
      rewardId?: string | undefined;
      method?: PaymentMethod | undefined;
      country?: string | undefined;
    },
  ): Promise<PreparedContribution> {
    const kind = assertCollectible(request.kind);
    const context = await this.context(projectId, contributorId, request.country);
    if (!(context.project.instruments as readonly string[]).includes(kind)) {
      throw new DomainError('PAYMENTS_INSTRUMENT_NOT_ACCEPTED', `The project refuses ${kind}`);
    }
    const { account, route, availability } = context;
    if (availability === 'campaign_closed' || availability === 'funding_frozen') {
      throw new DomainError('PAYMENTS_PROJECT_NOT_OPEN', 'The project is not open', {
        reason: availability,
      });
    }
    if (availability === 'holder_without_covered_payout_account' || !account || !route) {
      throw new DomainError('PAYMENTS_HOLDER_PAYOUT_NOT_COVERED', 'No covered payout account', {
        reason: 'holder_without_covered_payout_account',
      });
    }
    if (availability === 'holder_not_verified') {
      throw new DomainError('PAYMENTS_HOLDER_NOT_READY', 'The holder is not verified yet', {
        reason: availability,
      });
    }
    const amount = Money.fromJSON(request.amount);
    const offered = offeredMethods(this.providers.enabled());
    const methods =
      request.method && !offered.includes(request.method) ? [...offered, request.method] : offered;
    const { evaluation, rates } = await this.evaluate(route, methods, {
      contributorCountry: context.contributorCountry,
      currency: amount.currency,
      amountMinor: amount.amountMinor,
    });
    const chosen = request.method
      ? evaluation.available.find(({ capability }) => capability.method === request.method)
      : evaluation.available[0];
    const rate = rates.get(amount.currency);
    if (!chosen || !rate) throw refusal(evaluation, request.method);
    const reward = request.rewardId ? await this.rewardTerms(projectId, request.rewardId) : null;
    const quote = buildQuote({
      kind,
      amount,
      rate,
      terms: this.config.payments.commission,
      estimatedFee: estimateFee(
        PROVIDER_CAPABILITIES[route.provider],
        route.country,
        chosen.capability.method,
        amount,
      ),
      reward,
    });
    // The evaluation already bounds the amount; the EUR equivalent is checked again on the quote.
    assertWithinBounds(quote, {
      minEur: Money.of(this.config.payments.minEurMinor, EUR),
      maxEur: Money.of(this.config.payments.maxEurMinor, EUR),
      providerMinMinor: chosen.capability.minMinor,
      providerMaxMinor: chosen.capability.maxMinor,
    });
    return {
      context: { ...context, account, route },
      quote,
      payment: chosen.capability,
      evaluation,
    };
  }

  /**
   * Evaluates the methods on the rail with the platform bounds converted at the current rate of
   * each currency of the rail (asked currency only, when given); a currency without a rate is not
   * supported. Returns the rates, which the session locks.
   */
  private async evaluate(
    route: PayoutRoute,
    methods: readonly PaymentMethod[],
    request: PaymentRequest,
  ): Promise<{ evaluation: PaymentEvaluation; rates: Map<string, Rate> }> {
    const capabilities = PROVIDER_CAPABILITIES[route.provider];
    const currencies = new Set(
      enabledCapabilities(capabilities)
        .payments.map((payment) => payment.currency)
        .filter(
          (currency) =>
            (capabilities.paymentCurrencies === 'any' || currency === route.currency) &&
            (!request.currency || currency === request.currency),
        ),
    );
    const rates = new Map<string, Rate>();
    const bounds = new Map<string, Bounds>();
    for (const currency of currencies) {
      const rate = await this.rateOrNull(currency);
      if (!rate) continue;
      rates.set(currency, rate);
      bounds.set(currency, {
        minMinor: smallestAmountReaching(
          Money.of(this.config.payments.minEurMinor, EUR),
          currency,
          rate,
        ).amountMinor,
        maxMinor: largestAmountWithin(
          Money.of(this.config.payments.maxEurMinor, EUR),
          currency,
          rate,
        ).amountMinor,
      });
    }
    return {
      evaluation: evaluatePayments(
        route,
        methods,
        request,
        (currency) => bounds.get(currency) ?? null,
      ),
      rates,
    };
  }

  private async rewardTerms(projectId: string, rewardId: string): Promise<RewardTerms> {
    const reward = await this.projects.reward(rewardId);
    if (!reward || reward.projectId !== projectId) {
      throw new DomainError('PROJECTS_REWARD_NOT_FOUND', 'Reward not found');
    }
    return {
      id: reward.id,
      minAmount: reward.minAmount,
      instruments: reward.instruments,
      available: reward.available,
    };
  }

  private async rateOrNull(currency: string): Promise<Rate | null> {
    try {
      return await this.fx.rate(currency, this.clock.now());
    } catch {
      return null;
    }
  }
}

/**
 * The refusal of a payment no method takes, with the reason the options give: a method asked is
 * `PAYMENTS_METHOD_NOT_AVAILABLE`; otherwise an amount outside every bound is
 * `PAYMENTS_AMOUNT_OUT_OF_RANGE`, anything else `PAYMENTS_CURRENCY_NOT_AVAILABLE`.
 */
function refusal(evaluation: PaymentEvaluation, method: PaymentMethod | undefined): DomainError {
  if (method) {
    const reason =
      evaluation.unavailable.find((entry) => entry.method === method)?.reason ??
      'currency_not_supported';
    return new DomainError('PAYMENTS_METHOD_NOT_AVAILABLE', `${method} is not available`, {
      reason,
    });
  }
  const reason = closestReason(evaluation);
  return reason === 'amount_out_of_range'
    ? new DomainError('PAYMENTS_AMOUNT_OUT_OF_RANGE', 'Amount out of the allowed range', { reason })
    : new DomainError('PAYMENTS_CURRENCY_NOT_AVAILABLE', 'No method in this currency', { reason });
}

function methodOption(option: MethodOption, currency: string): PaymentMethodOption {
  return {
    method: option.method,
    operators: option.operators,
    min: Money.of(option.bounds.minMinor, currency).toJSON(),
    max: Money.of(option.bounds.maxMinor, currency).toJSON(),
  };
}

function collectedKinds(project: FundableProject): ContributionKind[] {
  return (['donation', 'reward_crowdfunding', 'love_money'] as const).filter((kind) =>
    (project.instruments as readonly string[]).includes(kind),
  );
}

/** Largest amount of a currency whose EUR equivalent stays within the given euros. */
function largestAmountWithin(eur: Money, currency: string, rate: Rate): Money {
  const next = smallestAmountReaching(eur.add(Money.of(1n, EUR)), currency, rate);
  const candidate = next.subtract(Money.of(1n, currency));
  return eurEquivalent(candidate, rate).compare(eur) <= 0 ? candidate : Money.zero(currency);
}

export function quoteView(quote: Quote, methods: PaymentMethodOption[]): ContributionQuote {
  return {
    kind: quote.kind,
    amount: quote.amount.toJSON(),
    eurEquivalent: quote.eurEquivalent.toJSON(),
    rate: {
      unitsPerEur: quote.rate.unitsPerEur,
      source: quote.rate.source,
      at: quote.rate.at.toISOString(),
    },
    commission: quote.commission.toJSON(),
    commissionRateBps: quote.terms.rateBps,
    commissionVersion: quote.terms.version,
    estimatedProviderFee: quote.estimatedProviderFee?.toJSON() ?? null,
    estimatedHolderAmount: quote.estimatedHolderAmount?.toJSON() ?? null,
    reward: quote.reward
      ? {
          rewardId: quote.reward.rewardId,
          minAmount: quote.reward.minAmount.toJSON(),
          eligible: quote.reward.eligible,
        }
      : null,
    methods,
  };
}
