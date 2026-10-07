import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  API_CONFIG,
  type ApiConfig,
  COMMON_CONFIG,
  type CommonConfig,
} from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import {
  FxRateProvider,
  type PaymentProvider,
  PaymentProviders,
  type PayoutAccountProvider,
} from '../application/ports';
import type { ProviderId } from '../domain/capability-matrix';
import { fixedRate, type Rate } from '../domain/fx';
import { FlutterwaveFxRateProvider, FlutterwaveProvider } from './flutterwave/flutterwave.provider';
import { SimulatedFxRateProvider, SimulatedProvider } from './simulated/simulated.provider';
import { StripeProvider } from './stripe/stripe.provider';

type Adapter = PaymentProvider & PayoutAccountProvider;

/**
 * Adapters of the enabled providers: the simulated one alone with PAYMENTS_MODE=simulated
 * (refused in production), otherwise Stripe and Flutterwave when their credentials are set.
 */
@Injectable()
export class ConfiguredPaymentProviders extends PaymentProviders {
  private readonly adapters = new Map<ProviderId, Adapter>();
  readonly simulated: SimulatedProvider | null;

  constructor(
    @Inject(COMMON_CONFIG) config: CommonConfig,
    transactions: TransactionManager,
    clock: Clock,
    ids: IdGenerator,
    @Optional() @Inject(API_CONFIG) api: ApiConfig | null,
  ) {
    super();
    const { payments } = config;
    this.simulated =
      payments.mode === 'simulated'
        ? new SimulatedProvider(
            transactions,
            clock,
            ids,
            payments.simulated.webhookSecret,
            api?.http.publicUrl ?? '',
          )
        : null;
    if (this.simulated) {
      this.adapters.set('simulated', this.simulated);
      return;
    }
    if (payments.stripe) this.adapters.set('stripe', new StripeProvider(payments.stripe));
    if (payments.flutterwave) {
      this.adapters.set('flutterwave', new FlutterwaveProvider(payments.flutterwave));
    }
  }

  enabled(): readonly ProviderId[] {
    return [...this.adapters.keys()];
  }

  payment(id: ProviderId): PaymentProvider {
    return this.adapter(id);
  }

  payout(id: ProviderId): PayoutAccountProvider {
    return this.adapter(id);
  }

  private adapter(id: ProviderId): Adapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new DomainError('PAYMENTS_PROVIDER_UNAVAILABLE', `Provider ${id} is not enabled`);
    }
    return adapter;
  }
}

/**
 * Rates (ADR 0046): EUR and the fixed parities without any call; the other currencies from the
 * simulated table in simulated mode, from Flutterwave in live mode, and none otherwise.
 */
@Injectable()
export class CompositeFxRateProvider extends FxRateProvider {
  private readonly floating: FxRateProvider | null;

  constructor(@Inject(COMMON_CONFIG) config: CommonConfig) {
    super();
    const { payments } = config;
    this.floating =
      payments.mode === 'simulated'
        ? new SimulatedFxRateProvider()
        : payments.flutterwave
          ? new FlutterwaveFxRateProvider(payments.flutterwave)
          : null;
  }

  rate(currency: string, at: Date): Promise<Rate> {
    const fixed = fixedRate(currency, at);
    if (fixed) return Promise.resolve(fixed);
    if (!this.floating) {
      return Promise.reject(
        new DomainError('PAYMENTS_CURRENCY_NOT_AVAILABLE', `No rate source for ${currency}`),
      );
    }
    return this.floating.rate(currency, at);
  }
}
