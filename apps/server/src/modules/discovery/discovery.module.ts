import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CardsService } from './application/cards.service';
import { DiscoverService } from './application/discover.service';
import { DiscoveryFacade } from './application/discovery.facade';
import { IndexMaintenanceService } from './application/index-maintenance.service';
import { IndexerService } from './application/indexer.service';
import { MatchingService } from './application/matching.service';
import { DiscoveryRepository } from './application/ports';
import { SearchService } from './application/search.service';
import { SuggestionsService } from './application/suggestions.service';
import { DrizzleDiscoveryRepository } from './infrastructure/drizzle-discovery.repository';
import { DiscoveryController } from './interface/discovery.controller';
import { DiscoveryJobsProcessor } from './interface/discovery-jobs.processor';
import { DISCOVERY_QUEUE } from './interface/discovery-queue';
import { IndexEventsHandler } from './interface/index-events.handler';
import { ProjectTeamResolver } from './interface/project-team.resolver';

const SHARED_PROVIDERS: Provider[] = [
  { provide: DiscoveryRepository, useClass: DrizzleDiscoveryRepository },
  CardsService,
  SuggestionsService,
  IndexerService,
  MatchingService,
  IndexMaintenanceService,
  DiscoveryFacade,
];

/**
 * Search, explained matching and Discover page (§10.2, §10.6, §11.4, ADR 0065 to 0068). The
 * projection is fed by the events of the modules (worker) and rebuilt from their facades
 * (`pnpm discovery:reindex`). Global so that the notifications module can inject
 * DiscoveryFacade; imports go through index.ts.
 */
@Module({})
export class DiscoveryModule {
  static forApi(): DynamicModule {
    return {
      module: DiscoveryModule,
      global: true,
      controllers: [DiscoveryController],
      providers: [...SHARED_PROVIDERS, SearchService, DiscoverService, ProjectTeamResolver],
      exports: [DiscoveryFacade, IndexMaintenanceService],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: DiscoveryModule,
      global: true,
      imports: [BullModule.registerQueue({ name: DISCOVERY_QUEUE })],
      providers: [...SHARED_PROVIDERS, IndexEventsHandler, DiscoveryJobsProcessor],
      exports: [DiscoveryFacade, IndexMaintenanceService],
    };
  }
}
