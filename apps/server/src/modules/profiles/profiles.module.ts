import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CurrentUserService } from './application/current-user.service';
import { ProfileAccessRegistry } from './application/profile-access.registry';
import { ProfileEventsRecorder } from './application/profile-events.recorder';
import { OrganizationDirectoryRegistry } from './application/organization-directory.registry';
import { ProfileDisplayService } from './application/profile-display.service';
import { ProfilesFacade } from './application/profiles.facade';
import { ProfilePrerequisitesProvider } from './application/profile-prerequisites.provider';
import { ProfileReadsService } from './application/profile-reads.service';
import { ProfileViewRegistry } from './application/profile-view.registry';
import { ProfilesService } from './application/profiles.service';
import { ProfileRepository, ReferenceDataRepository } from './application/ports';
import { ReferenceDataService } from './application/reference-data.service';
import { DrizzleProfileRepository } from './infrastructure/drizzle-profile.repository';
import { DrizzleReferenceDataRepository } from './infrastructure/drizzle-reference-data.repository';
import { MeController } from './interface/me.controller';
import { ProfilesController } from './interface/profiles.controller';
import {
  ImportedAvatarHandler,
  ProviderPhotoImportHandler,
} from './interface/profile-photos.handler';
import { UserRegisteredHandler } from './interface/user-registered.handler';

import { ProfilesPersonalData } from './infrastructure/profiles-personal-data';

import { ProfilesTranslatable } from './infrastructure/profiles-translatable';

const SHARED_PROVIDERS: Provider[] = [
  ProfilesTranslatable,
  ProfilesPersonalData,
  { provide: ProfileRepository, useClass: DrizzleProfileRepository },
  { provide: ReferenceDataRepository, useClass: DrizzleReferenceDataRepository },
  ProfileEventsRecorder,
  ReferenceDataService,
  ProfilesService,
  ProfilePrerequisitesProvider,
  OrganizationDirectoryRegistry,
  ProfileDisplayService,
  ProfileViewRegistry,
  ProfileAccessRegistry,
  ProfilesFacade,
];

/**
 * Base profile, entrepreneur and contributor facets, handle, privacy and reference data.
 * Global so that other modules can inject ProfilesFacade; imports go through index.ts.
 */
@Module({})
export class ProfilesModule {
  static forApi(): DynamicModule {
    return {
      module: ProfilesModule,
      global: true,
      controllers: [MeController, ProfilesController],
      providers: [...SHARED_PROVIDERS, ProfileReadsService, CurrentUserService],
      exports: [ProfilesFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ProfilesModule,
      global: true,
      exports: [ProfilesFacade],
      providers: [
        ...SHARED_PROVIDERS,
        UserRegisteredHandler,
        ProviderPhotoImportHandler,
        ImportedAvatarHandler,
      ],
    };
  }
}
