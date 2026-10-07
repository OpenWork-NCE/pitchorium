import { type DynamicModule, Module, type Provider } from '@nestjs/common';
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
];

/** Impact dashboard and shared time log (section 9.4); projection of the payments. */
@Module({})
export class EngagementModule {
  static forApi(): DynamicModule {
    return {
      module: EngagementModule,
      controllers: [EngagementController],
      providers: [...SHARED_PROVIDERS, OrganizationMemberResolver, TimeEntryResolver],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: EngagementModule,
      providers: [...SHARED_PROVIDERS, ContributionProjectionHandler],
    };
  }
}
