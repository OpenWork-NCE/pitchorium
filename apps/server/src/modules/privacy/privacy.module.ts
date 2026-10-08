import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ResidueScanner } from '../../platform/compliance';
import { ArchiveWriter } from './application/archive-writer';
import { ErasureExecutorService } from './application/erasure-executor.service';
import { ExportBuilderService } from './application/export-builder.service';
import { PersonalDataRegistry } from './application/personal-data';
import { PrivacyEventsRecorder } from './application/privacy-events.recorder';
import { PrivacyRequestsService } from './application/privacy-requests.service';
import { PrivacyFacade } from './application/privacy.facade';
import { PrivacyRepository } from './application/ports';
import { DrizzlePrivacyRepository } from './infrastructure/drizzle-privacy.repository';
import { PrivacyPersonalData } from './infrastructure/privacy-personal-data';
import { ZipArchiveWriter } from './infrastructure/zip-archive.writer';
import { PrivacyController } from './interface/privacy.controller';
import { ExportRequestedHandler, PrivacyJobsProcessor } from './interface/privacy-jobs.processor';
import { PRIVACY_QUEUE } from './interface/privacy-queue';

const SHARED_PROVIDERS: Provider[] = [
  { provide: PrivacyRepository, useClass: DrizzlePrivacyRepository },
  PersonalDataRegistry,
  PrivacyEventsRecorder,
  PrivacyFacade,
  PrivacyPersonalData,
];

/**
 * Rights of the GDPR (§13, ADR 0074): exports and erasures, executed by the worker through the
 * exporters and erasers that every module holding personal data registers. Global so that
 * every module can inject PrivacyFacade; imports go through index.ts.
 */
@Module({})
export class PrivacyModule {
  static forApi(): DynamicModule {
    return {
      module: PrivacyModule,
      global: true,
      controllers: [PrivacyController],
      providers: [...SHARED_PROVIDERS, PrivacyRequestsService],
      exports: [PrivacyFacade],
    };
  }

  /**
   * Registry only, for an assembly of a few modules (the `admin:create` command, tests): the
   * modules register their contracts, nothing is exported or erased.
   */
  static forRegistrations(): DynamicModule {
    return {
      module: PrivacyModule,
      global: true,
      providers: [PersonalDataRegistry, PrivacyFacade],
      exports: [PrivacyFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: PrivacyModule,
      global: true,
      imports: [BullModule.registerQueue({ name: PRIVACY_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        ResidueScanner,
        { provide: ArchiveWriter, useClass: ZipArchiveWriter },
        ExportBuilderService,
        ErasureExecutorService,
        ExportRequestedHandler,
        PrivacyJobsProcessor,
      ],
      exports: [PrivacyFacade, ErasureExecutorService],
    };
  }
}
