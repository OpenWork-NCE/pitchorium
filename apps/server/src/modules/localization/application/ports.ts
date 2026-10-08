import type { Locale, TranslationProviderId } from '@pitchorium/contracts';

export interface GlossaryEntry {
  fr: string;
  en: string;
}

export interface ProviderRequest {
  texts: string[];
  /** Null: detected by the provider. */
  sourceLanguage: string | null;
  target: Locale;
  /** Sent only for the pairs the provider supports (glossaryApplies). */
  glossary: readonly GlossaryEntry[];
}

export interface ProviderResult {
  texts: string[];
  detectedLanguage: string | null;
}

/** Port: a machine translation provider (DeepL, Google Cloud Translation, simulated). */
export abstract class TranslationProvider {
  abstract readonly id: TranslationProviderId;
  abstract translate(request: ProviderRequest): Promise<ProviderResult>;
}

/** Providers configured, in order of preference (LOCALIZATION_PROVIDERS). */
export abstract class TranslationProviders {
  abstract list(): readonly TranslationProvider[];
}

export interface CachedTranslation {
  sourceType: string;
  sourceKey: string;
  targetLocale: string;
  contentHash: string;
  sourceLanguage: string | null;
  provider: TranslationProviderId;
  fields: Record<string, string>;
  createdAt: Date;
  expiresAt: Date;
}

export interface GlossaryTermRecord {
  id: string;
  fr: string;
  en: string;
  provisional: boolean;
  note: string | null;
  updatedAt: Date;
}

export abstract class LocalizationRepository {
  abstract findTranslation(
    sourceType: string,
    sourceKey: string,
    targetLocale: string,
  ): Promise<CachedTranslation | null>;
  abstract saveTranslation(translation: CachedTranslation): Promise<void>;
  abstract deleteTranslations(sourceType: string, sourceKey: string): Promise<number>;
  abstract purgeExpired(now: Date): Promise<number>;

  abstract memberUsage(userId: string, day: string): Promise<number>;
  abstract monthUsage(month: string): Promise<{ characters: number; warnedAt: Date | null }>;
  /** Adds the characters, returns the new monthly total. */
  abstract addUsage(
    userId: string,
    day: string,
    month: string,
    characters: number,
  ): Promise<number>;
  abstract markWarned(month: string, at: Date): Promise<void>;
  abstract usageOf(userId: string): Promise<{ day: string; characters: number }[]>;
  abstract deleteUsageOf(userId: string): Promise<void>;

  abstract glossary(): Promise<GlossaryTermRecord[]>;
  abstract findTerm(id: string): Promise<GlossaryTermRecord | null>;
  abstract findTermByFr(fr: string): Promise<GlossaryTermRecord | null>;
  abstract insertTerm(term: GlossaryTermRecord): Promise<boolean>;
  abstract updateTerm(id: string, patch: Partial<GlossaryTermRecord>): Promise<void>;
  abstract deleteTerm(id: string): Promise<boolean>;
}
