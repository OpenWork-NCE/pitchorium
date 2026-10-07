import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CurrentUserService } from './application/current-user.service';
import { ProfileEventsRecorder } from './application/profile-events.recorder';
import { ProfilePrerequisitesProvider } from './application/profile-prerequisites.provider';
import { ProfileReadsService } from './application/profile-reads.service';
import { ProfilesService } from './application/profiles.service';
import { ProfileRepository, ReferenceDataRepository } from './application/ports';
import { ReferenceDataService } from './application/reference-data.service';
import { DrizzleProfileRepository } from './infrastructure/drizzle-profile.repository';
import { DrizzleReferenceDataRepository } from './infrastructure/drizzle-reference-data.repository';
import { MeController } from './interface/me.controller';
import { ProfilesController } from './interface/profiles.controller';
import { UserRegisteredHandler } from './interface/user-registered.handler';

const SHARED_PROVIDERS: Provider[] = [
  { provide: ProfileRepository, useClass: DrizzleProfileRepository },
  { provide: ReferenceDataRepository, useClass: DrizzleReferenceDataRepository },
  ProfileEventsRecorder,
  ReferenceDataService,
  ProfilesService,
  ProfilePrerequisitesProvider,
];

/** Base profile, entrepreneur and contributor facets, handle, privacy and reference data. */
@Module({})
export class ProfilesModule {
  static forApi(): DynamicModule {
    return {
      module: ProfilesModule,
      controllers: [MeController, ProfilesController],
      providers: [...SHARED_PROVIDERS, ProfileReadsService, CurrentUserService],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ProfilesModule,
      providers: [...SHARED_PROVIDERS, UserRegisteredHandler],
    };
  }
}
