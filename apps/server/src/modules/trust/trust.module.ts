import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CaseFilingService } from './application/case-filing.service';
import { ModerationService } from './application/moderation.service';
import { NoticesService } from './application/notices.service';
import { TrustRepository } from './application/ports';
import { ReportsService } from './application/reports.service';
import { SignalsService } from './application/signals.service';
import { StandingService } from './application/standing.service';
import { SuspensionsService } from './application/suspensions.service';
import { TargetDirectory } from './application/target-directory';
import { TransparencyService } from './application/transparency.service';
import { TrustEventsRecorder } from './application/trust-events.recorder';
import { TrustFacade } from './application/trust.facade';
import { DrizzleTrustRepository } from './infrastructure/drizzle-trust.repository';
import { DecisionSubjectResolver } from './interface/decision-subject.resolver';
import { ModerationController } from './interface/moderation.controller';
import { ReportsController } from './interface/reports.controller';
import { StandingController } from './interface/standing.controller';
import { SignalsHandler, TrustJobsHandler } from './interface/trust-events.handler';
import { TrustJobsProcessor } from './interface/trust-jobs.processor';
import { TRUST_QUEUE } from './interface/trust-queue';

import { TrustPersonalData } from './infrastructure/trust-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  TrustPersonalData,
  { provide: TrustRepository, useClass: DrizzleTrustRepository },
  TrustEventsRecorder,
  TargetDirectory,
  CaseFilingService,
  SignalsService,
  SuspensionsService,
  TrustFacade,
];

/**
 * Trust and safety (§13): reports and notices, moderation queue, decisions with their
 * statement of reasons, appeals, suspensions, automatic signals and transparency counters.
 * Both processes register the suspension source with access. Global so that the notifications,
 * privacy and admin modules can inject TrustFacade; imports go through index.ts.
 */
@Module({})
export class TrustModule {
  static forApi(): DynamicModule {
    return {
      module: TrustModule,
      global: true,
      controllers: [ReportsController, StandingController, ModerationController],
      providers: [
        ...SHARED_PROVIDERS,
        ReportsService,
        ModerationService,
        StandingService,
        TransparencyService,
        DecisionSubjectResolver,
      ],
      exports: [TrustFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: TrustModule,
      global: true,
      imports: [BullModule.registerQueue({ name: TRUST_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        NoticesService,
        SignalsHandler,
        TrustJobsHandler,
        TrustJobsProcessor,
      ],
      exports: [TrustFacade],
    };
  }
}
