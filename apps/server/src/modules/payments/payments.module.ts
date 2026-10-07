import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ContributionEffectsService } from './application/contribution-effects.service';
import { ContributionsService } from './application/contributions.service';
import { ExportsService } from './application/exports.service';
import { OfflineService } from './application/offline.service';
import { PaymentsEventsRecorder } from './application/payments-events.recorder';
import { PaymentsFacade } from './application/payments.facade';
import { PaymentsMaintenanceService } from './application/payments-maintenance.service';
import { PayoutService } from './application/payout.service';
import {
  FxRateProvider,
  KycProvider,
  PaymentProviders,
  PaymentsRepository,
} from './application/ports';
import { QuotesService } from './application/quotes.service';
import { ReconciliationService } from './application/reconciliation.service';
import { RefundsService } from './application/refunds.service';
import { WebhooksService } from './application/webhooks.service';
import { DrizzlePaymentsRepository } from './infrastructure/drizzle-payments.repository';
import { ManualReviewKycProvider } from './infrastructure/manual-review-kyc.provider';
import {
  CompositeFxRateProvider,
  ConfiguredPaymentProviders,
} from './infrastructure/payment-providers';
import { PaymentsMailer } from './infrastructure/payments-mailer';
import { AdminPaymentsController } from './interface/admin-payments.controller';
import { ContributionsController } from './interface/contributions.controller';
import {
  OfflineContributionsController,
  PayoutController,
} from './interface/offline-and-payout.controller';
import {
  ContributionEmailsHandler,
  ProviderEventsHandler,
} from './interface/payments-events.handlers';
import { PaymentsJobsProcessor } from './interface/payments-jobs.processor';
import { PAYMENTS_QUEUE } from './interface/payments-queue';
import {
  ContributionResolver,
  OfflineContributionResolver,
  OrganizationRoleResolver,
  ProjectTeamResolver,
} from './interface/payments.resolvers';
import { SimulatedCheckoutHandler } from './interface/simulated-checkout.handler';
import { WebhooksHttpHandler } from './interface/webhooks.handler';

const SHARED_PROVIDERS: Provider[] = [
  { provide: PaymentsRepository, useClass: DrizzlePaymentsRepository },
  ConfiguredPaymentProviders,
  { provide: PaymentProviders, useExisting: ConfiguredPaymentProviders },
  { provide: FxRateProvider, useClass: CompositeFxRateProvider },
  { provide: KycProvider, useClass: ManualReviewKycProvider },
  PaymentsEventsRecorder,
  PayoutService,
  QuotesService,
  ContributionEffectsService,
  ContributionsService,
  RefundsService,
  OfflineService,
  WebhooksService,
  ReconciliationService,
  ExportsService,
  PaymentsFacade,
];

/**
 * Payments (section 9): contributions collected through licensed providers, off-platform
 * contributions, payout accounts and KYC of the holders, ledger and reconciliation. Global so
 * that the engagement module can inject PaymentsFacade; imports go through index.ts.
 */
@Module({})
export class PaymentsModule {
  static forApi(): DynamicModule {
    return {
      module: PaymentsModule,
      global: true,
      controllers: [
        ContributionsController,
        OfflineContributionsController,
        PayoutController,
        AdminPaymentsController,
      ],
      providers: [
        ...SHARED_PROVIDERS,
        ContributionResolver,
        ProjectTeamResolver,
        OrganizationRoleResolver,
        OfflineContributionResolver,
        WebhooksHttpHandler,
        SimulatedCheckoutHandler,
      ],
      exports: [PaymentsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: PaymentsModule,
      global: true,
      imports: [BullModule.registerQueue({ name: PAYMENTS_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        PaymentsMailer,
        PaymentsMaintenanceService,
        PaymentsJobsProcessor,
        ProviderEventsHandler,
        ContributionEmailsHandler,
      ],
      exports: [PaymentsFacade],
    };
  }
}
