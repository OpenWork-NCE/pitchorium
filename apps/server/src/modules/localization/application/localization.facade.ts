import { Injectable } from '@nestjs/common';
import type { Locale, LocaleStatus } from '@pitchorium/contracts';
import { LocalesService } from './locales.service';
import {
  type TranslatableSource,
  TranslatableSourcesRegistry,
} from './translatable-sources.registry';

/**
 * Public facade of the localization module: the modules owning contents register how a reader
 * reads them (translation on demand); the administration enables the locales through it.
 */
@Injectable()
export class LocalizationFacade {
  constructor(
    private readonly sources: TranslatableSourcesRegistry,
    private readonly locales: LocalesService,
  ) {}

  registerTranslatableSource(source: TranslatableSource): void {
    this.sources.register(source);
  }

  /** Refused (LOCALIZATION_LOCALE_NOT_READY) for an incomplete or unreviewed locale. */
  setLocaleEnabled(locale: Locale, enabled: boolean, actorId: string): Promise<LocaleStatus> {
    return this.locales.setEnabled(locale, enabled, actorId);
  }

  localeStatuses(): Promise<LocaleStatus[]> {
    return this.locales.statuses();
  }
}
