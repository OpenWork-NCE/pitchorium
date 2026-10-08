import {
  bigint,
  date,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const localizationSchema = pgSchema('localization');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Machine translations of user contents (§8.3), one per content and target locale, valid while
 * the fingerprint of the original is unchanged (a modification invalidates it) and until it
 * expires. No member identifier, except the key of a profile, deleted with the member.
 */
export const localizationTranslations = localizationSchema.table(
  'translations',
  {
    sourceType: text('source_type').notNull(),
    sourceKey: text('source_key').notNull(),
    targetLocale: text('target_locale').notNull(),
    contentHash: text('content_hash').notNull(),
    sourceLanguage: text('source_language'),
    provider: text('provider').notNull(),
    fields: jsonb('fields').$type<Record<string, string>>().notNull(),
    createdAt: timestamptz('created_at').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'translations_pk',
      columns: [table.sourceType, table.sourceKey, table.targetLocale],
    }),
    index('translations_expires_at_idx').on(table.expiresAt),
  ],
);

/** Characters a member had translated per day (limit per member). */
export const localizationUsage = localizationSchema.table(
  'usage',
  {
    userId: uuid('user_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    characters: integer('characters').notNull(),
  },
  (table) => [primaryKey({ name: 'usage_pk', columns: [table.userId, table.day] })],
);

/** Characters sent to the providers per month (global cap, cost control). */
export const localizationMonthlyUsage = localizationSchema.table('monthly_usage', {
  month: text('month').primaryKey(),
  characters: bigint('characters', { mode: 'number' }).notNull(),
  warnedAt: timestamptz('warned_at'),
});

/** Business glossary FR and EN (palier, mécène, love money...), sent to the provider. */
export const localizationGlossaryTerms = localizationSchema.table(
  'glossary_terms',
  {
    id: uuid('id').primaryKey(),
    fr: text('fr').notNull(),
    en: text('en').notNull(),
    provisional: boolean('provisional').notNull(),
    note: text('note'),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [uniqueIndex('glossary_terms_fr_uq').on(table.fr)],
);
