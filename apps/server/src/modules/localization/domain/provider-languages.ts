import type { Locale, TranslationProviderId } from '@pitchorium/contracts';

export interface ProviderLanguages {
  /** Language codes (ISO 639-1) accepted as source and as target. */
  languages: readonly string[];
  /** Pairs for which the business glossary is sent (`source-target`). */
  glossaryPairs: readonly string[];
  source: string;
  checkedOn: string;
}

/**
 * Languages of each provider among those Pitchorium addresses (§8.2: fr, en, sw, wo, ln),
 * checked in their current documentation. Wolof is not offered by Google Cloud Translation,
 * contrary to the table of §8.2 (docs/open-questions.md).
 */
export const PROVIDER_LANGUAGES: Readonly<Record<TranslationProviderId, ProviderLanguages>> = {
  deepl: {
    languages: ['fr', 'en', 'sw', 'wo', 'ln'],
    glossaryPairs: ['fr-en', 'en-fr'],
    source: 'https://developers.deepl.com/docs/getting-started/supported-languages',
    checkedOn: '2026-10-08',
  },
  google: {
    languages: ['fr', 'en', 'sw', 'ln'],
    glossaryPairs: [],
    source: 'https://docs.cloud.google.com/translate/docs/languages',
    checkedOn: '2026-10-08',
  },
  simulated: {
    languages: ['fr', 'en', 'sw', 'wo', 'ln'],
    glossaryPairs: ['fr-en', 'en-fr'],
    source: 'Development and tests only',
    checkedOn: '2026-10-08',
  },
};

/** The provider handles the pair; an unknown source is detected by the provider. */
export function supports(
  provider: TranslationProviderId,
  sourceLanguage: string | null,
  target: Locale,
): boolean {
  const { languages } = PROVIDER_LANGUAGES[provider];
  return (
    languages.includes(target) && (sourceLanguage === null || languages.includes(sourceLanguage))
  );
}

export function glossaryApplies(
  provider: TranslationProviderId,
  sourceLanguage: string | null,
  target: Locale,
): boolean {
  return (
    sourceLanguage !== null &&
    PROVIDER_LANGUAGES[provider].glossaryPairs.includes(`${sourceLanguage}-${target}`)
  );
}
