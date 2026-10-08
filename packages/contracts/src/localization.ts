import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { localeSchema } from './locale.js';

/**
 * Translation on demand of user contents (§8.3, §14 V3): never silent, always labelled as a
 * machine translation with its provider; a message only on the explicit action of a
 * participant.
 */
export const TRANSLATION_SOURCE_TYPES = [
  'post',
  'comment',
  'profile',
  'project',
  'project_update',
  'event',
  'mission',
  'message',
] as const;
export const translationSourceTypeSchema = z.enum(TRANSLATION_SOURCE_TYPES);

export const TRANSLATION_PROVIDERS = ['deepl', 'google', 'simulated'] as const;
export const translationProviderSchema = z.enum(TRANSLATION_PROVIDERS);

export const translateRequestSchema = z
  .object({
    sourceType: translationSourceTypeSchema,
    /** Identifier of the content; for a profile, its handle. */
    sourceId: z.string().trim().min(1).max(64),
    /** An active interface locale (FR and EN at launch). */
    targetLocale: localeSchema,
  })
  .strict();

export const translationSchema = z.object({
  sourceType: translationSourceTypeSchema,
  sourceId: z.string(),
  targetLocale: localeSchema,
  /** Language of the original, as known or detected; null when unknown. */
  sourceLanguage: z.string().nullable(),
  /** Translated fields of the content (`text`, `title`, `description`...). */
  fields: z.record(z.string(), z.string()),
  machineTranslated: z.literal(true),
  provider: translationProviderSchema,
  /** i18n key of the notice to show with the text (`common.machineTranslation`). */
  notice: z.literal('common.machineTranslation'),
  cached: z.boolean(),
});

export const GLOSSARY_TERM_MAX_LENGTH = 100;

/** A term of the business glossary (palier, mécène, love money...), FR and EN. */
export const glossaryTermSchema = z.object({
  id: uuidV7Schema,
  fr: z.string(),
  en: z.string(),
  /** Translation not yet validated by a professional reviewer. */
  provisional: z.boolean(),
  note: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export const upsertGlossaryTermRequestSchema = z
  .object({
    fr: z.string().trim().min(1).max(GLOSSARY_TERM_MAX_LENGTH),
    en: z.string().trim().min(1).max(GLOSSARY_TERM_MAX_LENGTH),
    provisional: z.boolean().default(true),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .strict();

export const glossarySchema = z.object({ items: z.array(glossaryTermSchema) });
export const glossaryTermIdParamsSchema = z.object({ termId: uuidV7Schema });

/** Characters sent to the providers this month, against the global cap (cost control). */
export const translationUsageSchema = z.object({
  month: z.string(),
  characters: z.number().int(),
  monthlyCap: z.number().int(),
  memberDailyLimit: z.number().int(),
  providers: z.array(translationProviderSchema),
});

/** State of an interface locale and what its activation requires (§4, §8.3). */
export const localeStatusSchema = z.object({
  locale: localeSchema,
  enabled: z.boolean(),
  catalog: z.object({ total: z.number().int(), missing: z.number().int(), complete: z.boolean() }),
  review: z.object({
    status: z.string(),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().nullable(),
  }),
  activatable: z.boolean(),
});
export const localeStatusListSchema = z.object({ items: z.array(localeStatusSchema) });

export type TranslationSourceType = z.infer<typeof translationSourceTypeSchema>;
export type TranslationProviderId = z.infer<typeof translationProviderSchema>;
export type TranslateRequest = z.infer<typeof translateRequestSchema>;
export type Translation = z.infer<typeof translationSchema>;
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;
export type UpsertGlossaryTermRequest = z.infer<typeof upsertGlossaryTermRequestSchema>;
export type TranslationUsage = z.infer<typeof translationUsageSchema>;
export type LocaleStatus = z.infer<typeof localeStatusSchema>;
