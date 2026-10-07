import { Inject, Injectable } from '@nestjs/common';
import {
  type ContributionKind,
  type ContributionQuote,
  type ContributionRequestKind,
  type PaymentMethod,
  type PaymentOptions,
  type PaymentsUnavailableReason,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Clock, DomainError, Money } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { type FundableProject, ProjectsFacade } from '../../projects';
import { type PaymentCapability, PROVIDER_CAPABILITIES } from '../domain/capability-matrix';
import { assertCollectible } from '../domain/contribution';
import { EUR, eurEquivalent, type Rate, smallestAmountReaching } from '../domain/fx';
import type { PayoutAccountRecord } from '../domain/payout';
import { assertWithinBounds, buildQuote, type Quote, type RewardTerms } from '../domain/quote';
import {
  availablePayments,
  estimateFee,
  methodsByCurrency,
  type PayoutRoute,
  providerBounds,
  requirePayment,
} from '../domain/routing';
import { PayoutService } from './payout.service';
import { FxRateProvider, PaymentsRepository } from './ports';

/** Where a contribution to a project stands before paying. */
export interface PaymentContext {
  project: FundableProject;
  account: PayoutAccountRecord | null;
  route: PayoutRoute | null;
  contributorCountry: string | null;
  unavailableReason: PaymentsUnavailableReason | null;
}

export interface PreparedContribution {
  context: PaymentContext & { account: PayoutAccountRecord; route: PayoutRoute };
  quote: Quote;
  payment: PaymentCapability;
}

const projectNotFound = () => new DomainError('PROJECTS_NOT_FOUND', 'Project not found');

/**
 * Payment options and quotes (section 9.3 steps 1 to 3 and 7): the methods really available to
 * this contributor for this project, the EUR equivalent, the commission and the estimated fees.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly projects: ProjectsFacade,
    private readonly profiles: ProfilesFacade,
    private readonly payments: PaymentsRepository,
    private readonly payout: PayoutService,
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
    const account = await this.payments.findPayoutAccount(project.ownerId);
    const route = account
      ? { provider: account.provider, country: account.country, currency: account.currency }
      : null;
    const contributorCountry = country ?? (await this.profiles.countryOf(contributorId));
    let unavailableReason: PaymentsUnavailableReason | null = null;
    if (!project.open) unavailableReason = 'project_not_open';
    else if (!(await this.payout.collectionOpen(project.ownerId))) {
      unavailableReason = 'holder_not_ready';
    } else if (route && availablePayments(route, contributorCountry).length === 0) {
      unavailableReason = 'no_payment_route';
    }
    return { project, account, route, contributorCountry, unavailableReason };
  }

  async options(
    projectId: string,
    contributorId: string,
    country: string | undefined,
  ): Promise<PaymentOptions> {
    const context = await this.context(projectId, contributorId, country);
    const kinds = collectedKinds(context.project);
    const base = {
      projectId,
      acceptsPayments: context.unavailableReason === null,
      unavailableReason: context.unavailableReason,
      contributorCountry: context.contributorCountry,
      kinds,
      commissionRateBps: this.config.payments.commission.rateBps,
      anonymousDonations: this.config.payments.anonymousDonations,
    };
    if (context.unavailableReason !== null || !context.route) return { ...base, currencies: [] };
    const payments = availablePayments(context.route, context.contributorCountry);
    const currencies = [];
    for (const [currency, methods] of methodsByCurrency(payments)) {
      const rate = await this.rateOrNull(currency);
      if (!rate) continue;
      const bounds = providerBounds(payments.filter((payment) => payment.currency === currency));
      const min = smallestAmountReaching(
        Money.of(this.config.payments.minEurMinor, EUR),
        currency,
        rate,
      );
      const max = largestAmountWithin(
        Money.of(this.config.payments.maxEurMinor, EUR),
        currency,
        rate,
      );
      currencies.push({
        currency,
        min: Money.of(
          bounds.minMinor !== null && bounds.minMinor > min.amountMinor
            ? bounds.minMinor
            : min.amountMinor,
          currency,
        ).toJSON(),
        max: Money.of(
          bounds.maxMinor !== null && bounds.maxMinor < max.amountMinor
            ? bounds.maxMinor
            : max.amountMinor,
          currency,
        ).toJSON(),
        methods,
      });
    }
    return { ...base, currencies };
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
    return quoteView(prepared.quote, this.methodsOf(prepared));
  }

  /**
   * Every check before a payment: collected kind accepted by the project, holder ready, route
   * and method for this contributor, rate, bounds and reward. The rate returned is the one the
   * session locks.
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
    if (context.unavailableReason === 'project_not_open') {
      throw new DomainError('PAYMENTS_PROJECT_NOT_OPEN', 'The project is not open');
    }
    if (context.unavailableReason === 'holder_not_ready' || !context.account || !context.route) {
      throw new DomainError('PAYMENTS_HOLDER_NOT_READY', 'The holder cannot receive payments yet');
    }
    if (context.unavailableReason === 'no_payment_route') {
      throw new DomainError('PAYMENTS_NO_PAYMENT_ROUTE', 'No payment method for this contribution');
    }
    const amount = Money.fromJSON(request.amount);
    const payments = availablePayments(context.route, context.contributorCountry);
    const payment = request.method
      ? requirePayment(context.route, context.contributorCountry, amount.currency, request.method)
      : payments.find((candidate) => candidate.currency === amount.currency);
    if (!payment) {
      throw new DomainError(
        'PAYMENTS_CURRENCY_NOT_AVAILABLE',
        `Payments in ${amount.currency} are not available`,
      );
    }
    const rate = await this.fx.rate(amount.currency, this.clock.now());
    const reward = request.rewardId ? await this.rewardTerms(projectId, request.rewardId) : null;
    const quote = buildQuote({
      kind,
      amount,
      rate,
      terms: this.config.payments.commission,
      estimatedFee: estimateFee(
        PROVIDER_CAPABILITIES[context.route.provider],
        context.route.country,
        payment.method,
        amount,
      ),
      reward,
    });
    const bounds = providerBounds(
      payments.filter(
        (candidate) =>
          candidate.currency === amount.currency &&
          (!request.method || candidate.method === request.method),
      ),
    );
    assertWithinBounds(quote, {
      minEur: Money.of(this.config.payments.minEurMinor, EUR),
      maxEur: Money.of(this.config.payments.maxEurMinor, EUR),
      providerMinMinor: bounds.minMinor,
      providerMaxMinor: bounds.maxMinor,
    });
    return {
      context: { ...context, account: context.account, route: context.route },
      quote,
      payment,
    };
  }

  private methodsOf(prepared: PreparedContribution) {
    const payments = availablePayments(
      prepared.context.route,
      prepared.context.contributorCountry,
    ).filter((payment) => payment.currency === prepared.quote.amount.currency);
    return methodsByCurrency(payments).get(prepared.quote.amount.currency) ?? [];
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

export function quoteView(
  quote: Quote,
  methods: { method: PaymentMethod; operators: string[] }[],
): ContributionQuote {
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
