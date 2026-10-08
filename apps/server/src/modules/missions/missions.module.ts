import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { MissionEventsRecorder } from './application/mission-events.recorder';
import { MissionReadsService } from './application/mission-reads.service';
import { MissionsFacade } from './application/missions.facade';
import { MissionsService } from './application/missions.service';
import { MissionsRepository } from './application/ports';
import { DrizzleMissionsRepository } from './infrastructure/drizzle-missions.repository';
import { EngagementResolver, MissionResolver } from './interface/mission.resolvers';
import { MissionsController } from './interface/missions.controller';

import { MissionsPersonalData } from './infrastructure/missions-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  MissionsPersonalData,
  { provide: MissionsRepository, useClass: DrizzleMissionsRepository },
  MissionEventsRecorder,
  MissionReadsService,
  MissionsFacade,
];

/**
 * Volunteer expertise missions (§6.3, §14, ADR 0071). Global so that the discovery and
 * notifications modules can inject MissionsFacade; imports go through index.ts.
 */
@Module({})
export class MissionsModule {
  static forApi(): DynamicModule {
    return {
      module: MissionsModule,
      global: true,
      controllers: [MissionsController],
      providers: [...SHARED_PROVIDERS, MissionsService, MissionResolver, EngagementResolver],
      exports: [MissionsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: MissionsModule,
      global: true,
      providers: SHARED_PROVIDERS,
      exports: [MissionsFacade],
    };
  }
}
