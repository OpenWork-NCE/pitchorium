import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const discoverySchema = pgSchema('discovery');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const minorUnits = (name: string) => bigint(name, { mode: 'bigint' });
const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/**
 * Search projection (ADR 0065), built from the events of the modules and rebuilt from their
 * facades. One row per indexed entity and audience: `members` (what a signed-in member may
 * see) and `public` (what a visitor may see, absent when nothing is public). Drafts, deleted
 * and moderated entities are never indexed.
 */
export const discoverySearchDocuments = discoverySchema.table(
  'search_documents',
  {
    kind: text('kind').notNull(),
    entityId: uuid('entity_id').notNull(),
    audience: text('audience').notNull(),
    /** Public key: handle, slug or id. */
    key: text('key').notNull(),
    /** Member behind the entity, hidden across a block (null for an organization). */
    ownerId: uuid('owner_id'),
    name: text('name').notNull(),
    /** Lower case without accents, for the trigram search and the autocompletion. */
    nameNormalized: text('name_normalized').notNull(),
    subtitle: text('subtitle'),
    /** Weighted text (ADR 0066): A name, B subtitle, C body, D labels of sectors and countries. */
    document: tsvector('document').notNull(),
    countryCodes: text('country_codes').array().notNull(),
    sectorCodes: text('sector_codes').array().notNull(),
    /** Filters and matching attributes (`facet:entrepreneur`, `hat:mentor`, `lang:fr`...). */
    tags: text('tags').array().notNull(),
    status: text('status'),
    impactScore: integer('impact_score'),
    amountMinor: minorUnits('amount_minor'),
    currency: text('currency'),
    startsAt: timestamptz('starts_at'),
    endsAt: timestamptz('ends_at'),
    publishedAt: timestamptz('published_at'),
    featuredAt: timestamptz('featured_at'),
    /** Hash of the indexed content, compared with the sources by the drift check. */
    fingerprint: text('fingerprint').notNull(),
    indexedAt: timestamptz('indexed_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'search_documents_pk',
      columns: [table.kind, table.entityId, table.audience],
    }),
    index('search_documents_document_idx').using('gin', table.document),
    index('search_documents_name_trgm_idx').using('gin', table.nameNormalized.op('gin_trgm_ops')),
    index('search_documents_tags_idx').using('gin', table.tags),
    index('search_documents_countries_idx').using('gin', table.countryCodes),
    index('search_documents_sectors_idx').using('gin', table.sectorCodes),
    index('search_documents_recent_idx').on(
      table.audience,
      table.kind,
      table.publishedAt,
      table.entityId,
    ),
    index('search_documents_ends_at_idx')
      .on(table.audience, table.kind, table.endsAt, table.entityId)
      .where(sql`${table.endsAt} is not null`),
    index('search_documents_starts_at_idx')
      .on(table.audience, table.kind, table.startsAt, table.entityId)
      .where(sql`${table.startsAt} is not null`),
    index('search_documents_key_idx').on(table.kind, table.key),
  ],
);

/**
 * Matching attributes of a member (ADR 0067): both facets with the visibility of their
 * details. A facet whose details are private is used for its own member only.
 */
export const discoveryMatchProfiles = discoverySchema.table(
  'match_profiles',
  {
    userId: uuid('user_id').primaryKey(),
    displayName: text('display_name').notNull(),
    residenceCountry: text('residence_country'),
    languages: text('languages').array().notNull(),
    hasEntrepreneur: boolean('has_entrepreneur').notNull(),
    entrepreneurVisibility: text('entrepreneur_visibility').notNull(),
    companyCountry: text('company_country'),
    entrepreneurSector: text('entrepreneur_sector'),
    needs: text('needs').array().notNull(),
    fundingTargetMinor: minorUnits('funding_target_minor'),
    fundingTargetCurrency: text('funding_target_currency'),
    hasContributor: boolean('has_contributor').notNull(),
    contributorVisibility: text('contributor_visibility').notNull(),
    hats: text('hats').array().notNull(),
    interventionCountries: text('intervention_countries').array().notNull(),
    contributorSectors: text('contributor_sectors').array().notNull(),
    ticketMinMinor: minorUnits('ticket_min_minor'),
    ticketMaxMinor: minorUnits('ticket_max_minor'),
    ticketCurrency: text('ticket_currency'),
    instruments: text('instruments').array().notNull(),
    mentoringAvailable: boolean('mentoring_available').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    index('match_profiles_hats_idx').using('gin', table.hats),
    index('match_profiles_needs_idx').using('gin', table.needs),
    index('match_profiles_contributor_sectors_idx').using('gin', table.contributorSectors),
    index('match_profiles_intervention_idx').using('gin', table.interventionCountries),
    index('match_profiles_company_country_idx')
      .on(table.companyCountry)
      .where(sql`${table.hasEntrepreneur}`),
    index('match_profiles_entrepreneur_sector_idx')
      .on(table.entrepreneurSector)
      .where(sql`${table.hasEntrepreneur}`),
  ],
);

/**
 * Precomputed suggestions (ADR 0068): the best candidates of each list of a subject (a member,
 * or a project for its potential contributors), with their score and reasons.
 */
export const discoverySuggestions = discoverySchema.table(
  'suggestions',
  {
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    list: text('list').notNull(),
    candidateKind: text('candidate_kind').notNull(),
    candidateId: uuid('candidate_id').notNull(),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').$type<unknown[]>().notNull(),
    rulesVersion: integer('rules_version').notNull(),
    /** First time this candidate entered the list (new suggestions notification). */
    firstSuggestedAt: timestamptz('first_suggested_at').notNull(),
    computedAt: timestamptz('computed_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'suggestions_pk',
      columns: [
        table.subjectType,
        table.subjectId,
        table.list,
        table.candidateKind,
        table.candidateId,
      ],
    }),
    index('suggestions_ranking_idx').on(
      table.subjectType,
      table.subjectId,
      table.list,
      table.score,
      table.candidateId,
    ),
    index('suggestions_candidate_idx').on(table.candidateKind, table.candidateId),
    index('suggestions_first_suggested_idx').on(table.firstSuggestedAt),
  ],
);

/** « Pas intéressé » : a member never sees this candidate again. */
export const discoveryDismissals = discoverySchema.table(
  'dismissals',
  {
    userId: uuid('user_id').notNull(),
    candidateKind: text('candidate_kind').notNull(),
    candidateId: uuid('candidate_id').notNull(),
    dismissedAt: timestamptz('dismissed_at').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'dismissals_pk',
      columns: [table.userId, table.candidateKind, table.candidateId],
    }),
  ],
);
