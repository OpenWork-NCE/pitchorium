/** Public facade of the localization module: the only file other modules may import. */
export { LocalizationFacade } from './application/localization.facade';
export type {
  TranslatableContent,
  TranslatableSource,
} from './application/translatable-sources.registry';
export { LocaleDisabled, LocaleEnabled, TranslationRequested } from './domain/localization-events';
export { LocalizationModule } from './localization.module';
