import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { BlockedProfilesFilter } from './application/blocked-profiles.filter';
import { BlocksService } from './application/blocks.service';
import { ConnectionsService } from './application/connections.service';
import { FollowTargetRegistry } from './application/follow-target.registry';
import { FollowsService } from './application/follows.service';
import { MemberDirectory } from './application/member-directory';
import { NetworkEventsRecorder } from './application/network-events.recorder';
import { NetworkFacade } from './application/network.facade';
import { NetworkMaintenanceService } from './application/network-maintenance.service';
import { NetworkReadsService } from './application/network-reads.service';
import { NetworkRepository, ProfileViewBuffer } from './application/ports';
import { ProfileViewsService } from './application/profile-views.service';
import { DrizzleNetworkRepository } from './infrastructure/drizzle-network.repository';
import { RedisProfileViewBuffer } from './infrastructure/redis-profile-view.buffer';
import { BlocksController } from './interface/blocks.controller';
import { ConnectionsController } from './interface/connections.controller';
import { FollowsController } from './interface/follows.controller';
import { MemberNetworkController } from './interface/member-network.controller';
import { NetworkJobsProcessor } from './interface/network-jobs.processor';
import { NETWORK_QUEUE } from './interface/network-queue';
import { ProfileViewsController } from './interface/profile-views.controller';

import { NetworkPersonalData } from './infrastructure/network-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  NetworkPersonalData,
  { provide: NetworkRepository, useClass: DrizzleNetworkRepository },
  { provide: ProfileViewBuffer, useClass: RedisProfileViewBuffer },
  FollowTargetRegistry,
  MemberDirectory,
  BlockedProfilesFilter,
  NetworkEventsRecorder,
  NetworkFacade,
];

/**
 * Follows, connections, blocks, network lists and profile views (§10.2). Global so that content,
 * messaging and the owners of follow targets can inject NetworkFacade; imports go through
 * index.ts.
 */
@Module({})
export class NetworkModule {
  static forApi(): DynamicModule {
    return {
      module: NetworkModule,
      global: true,
      controllers: [
        FollowsController,
        ConnectionsController,
        BlocksController,
        MemberNetworkController,
        ProfileViewsController,
      ],
      providers: [
        ...SHARED_PROVIDERS,
        FollowsService,
        ConnectionsService,
        BlocksService,
        NetworkReadsService,
        ProfileViewsService,
      ],
      exports: [NetworkFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: NetworkModule,
      global: true,
      imports: [BullModule.registerQueue({ name: NETWORK_QUEUE })],
      providers: [...SHARED_PROVIDERS, NetworkMaintenanceService, NetworkJobsProcessor],
      exports: [NetworkFacade],
    };
  }
}
