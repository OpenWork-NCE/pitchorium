import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { GlossaryService } from './application/glossary.service';
import { LocalesService } from './application/locales.service';
import { LocalizationEventsRecorder } from './application/localization-events.recorder';
import { LocalizationFacade } from './application/localization.facade';
import { LocalizationRepository, TranslationProviders } from './application/ports';
import { TranslatableSourcesRegistry } from './application/translatable-sources.registry';
import { TranslationService } from './application/translation.service';
import { DrizzleLocalizationRepository } from './infrastructure/drizzle-localization.repository';
import { LocalizationPersonalData } from './infrastructure/localization-personal-data';
import { ConfiguredTranslationProviders } from './infrastructure/translation-providers';
import {
  LOCALIZATION_QUEUE,
  LocalizationJobsProcessor,
} from './interface/localization-jobs.processor';
import { TranslationsController } from './interface/translations.controller';

const SHARED_PROVIDERS: Provider[] = [
  { provide: LocalizationRepository, useClass: DrizzleLocalizationRepository },
  LocalizationEventsRecorder,
  TranslatableSourcesRegistry,
  GlossaryService,
  LocalesService,
  LocalizationFacade,
  LocalizationPersonalData,
];

/**
 * Translation on demand of user contents and activation of the interface locales (§8, ADR
 * 0076 and 0077). Global so that the modules owning contents register their translatable
 * sources, and the administration enables the locales; imports go through index.ts.
 */
@Module({})
export class LocalizationModule {
  static forApi(): DynamicModule {
    return {
      module: LocalizationModule,
      global: true,
      controllers: [TranslationsController],
      providers: [
        ...SHARED_PROVIDERS,
        { provide: TranslationProviders, useClass: ConfiguredTranslationProviders },
        TranslationService,
      ],
      exports: [LocalizationFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: LocalizationModule,
      global: true,
      imports: [BullModule.registerQueue({ name: LOCALIZATION_QUEUE })],
      providers: [...SHARED_PROVIDERS, LocalizationJobsProcessor],
      exports: [LocalizationFacade],
    };
  }
}
