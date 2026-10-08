import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { EngagementFacade } from './application/engagement.facade';
import { EngagementService } from './application/engagement.service';
import { EngagementRepository } from './application/ports';
import { DrizzleEngagementRepository } from './infrastructure/drizzle-engagement.repository';
import { ContributionProjectionHandler } from './interface/contribution-projection.handler';
import {
  EngagementController,
  OrganizationMemberResolver,
  TimeEntryResolver,
} from './interface/engagement.controller';

const SHARED_PROVIDERS: Provider[] = [
  { provide: EngagementRepository, useClass: DrizzleEngagementRepository },
  EngagementService,
  EngagementFacade,
];

/**
 * Impact dashboard and shared time log (section 9.4); projection of the payments. Global so that
 * the missions module can inject EngagementFacade; imports go through index.ts.
 */
@Module({})
export class EngagementModule {
  static forApi(): DynamicModule {
    return {
      module: EngagementModule,
      global: true,
      exports: [EngagementFacade],
      controllers: [EngagementController],
      providers: [...SHARED_PROVIDERS, OrganizationMemberResolver, TimeEntryResolver],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: EngagementModule,
      global: true,
      exports: [EngagementFacade],
      providers: [...SHARED_PROVIDERS, ContributionProjectionHandler],
    };
  }
}
