import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const profilesSchema = pgSchema('profiles');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** ISO 3166-1 countries with their UN M49 regions (reference data, seeded). */
export const profilesCountries = profilesSchema.table('countries', {
  code: text('code').primaryKey(),
  m49Region: text('m49_region'),
  m49SubRegion: text('m49_sub_region'),
  m49IntermediateRegion: text('m49_intermediate_region'),
});

/** Sector taxonomy (provisional: ISIC Rev. 4 sections), seeded. */
export const profilesSectors = profilesSchema.table('sectors', {
  code: text('code').primaryKey(),
  isicSection: text('isic_section').notNull(),
  position: integer('position').notNull(),
});

/** Company stages (provisional), seeded. */
export const profilesStages = profilesSchema.table('stages', {
  code: text('code').primaryKey(),
  position: integer('position').notNull(),
});

/** Base profile, one per account; the key is the identity user id (no cross-module FK). */
export const profilesProfiles = profilesSchema.table(
  'profiles',
  {
    userId: uuid('user_id').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    headline: text('headline'),
    bio: text('bio'),
    countryCode: text('country_code').references(() => profilesCountries.code),
    city: text('city'),
    languages: text('languages').array().notNull(),
    websiteUrl: text('website_url'),
    linkedinUrl: text('linkedin_url'),
    // Photo pre-filled by the OAuth provider; the media module will set avatar_media_id.
    avatarUrl: text('avatar_url'),
    avatarMediaId: uuid('avatar_media_id'),
    coverMediaId: uuid('cover_media_id'),
    intention: text('intention'),
    intentionSetAt: timestamptz('intention_set_at'),
    publicPageEnabled: boolean('public_page_enabled').notNull(),
    entrepreneurDetailsVisibility: text('entrepreneur_details_visibility').notNull(),
    contributorDetailsVisibility: text('contributor_details_visibility').notNull(),
    networkListsVisibility: text('network_lists_visibility').notNull(),
    /** Editorial highlight by a moderator or an administrator (administration module). */
    featuredAt: timestamptz('featured_at'),
    featuredBy: uuid('featured_by'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [uniqueIndex('profiles_handle_uq').on(table.handle)],
);

/** Former handles, kept for redirects and never reassigned to another member. */
export const profilesHandleHistory = profilesSchema.table(
  'handle_history',
  {
    handle: text('handle').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profilesProfiles.userId, { onDelete: 'cascade' }),
    replacedAt: timestamptz('replaced_at').notNull(),
  },
  (table) => [index('handle_history_user_id_idx').on(table.userId)],
);

export const profilesEntrepreneurFacets = profilesSchema.table('entrepreneur_facets', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => profilesProfiles.userId, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  sectorCode: text('sector_code')
    .notNull()
    .references(() => profilesSectors.code),
  stageCode: text('stage_code')
    .notNull()
    .references(() => profilesStages.code),
  companyCountryCode: text('company_country_code')
    .notNull()
    .references(() => profilesCountries.code),
  companyCity: text('company_city'),
  teamSize: integer('team_size'),
  foundedYear: integer('founded_year'),
  pitch: text('pitch'),
  needs: text('needs').array().notNull(),
  soughtExpertise: text('sought_expertise').array().notNull(),
  fundingTargetMinor: bigint('funding_target_minor', { mode: 'bigint' }),
  fundingTargetCurrency: text('funding_target_currency'),
  createdAt: timestamptz('created_at').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});

export const profilesContributorFacets = profilesSchema.table(
  'contributor_facets',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => profilesProfiles.userId, { onDelete: 'cascade' }),
    hats: text('hats').array().notNull(),
    structureType: text('structure_type').notNull(),
    organizationName: text('organization_name'),
    /** Organization of the organizations module (no cross-module FK). */
    organizationId: uuid('organization_id'),
    interventionCountryCodes: text('intervention_country_codes').array().notNull(),
    sectorCodes: text('sector_codes').array().notNull(),
    ticketMinMinor: bigint('ticket_min_minor', { mode: 'bigint' }),
    ticketMaxMinor: bigint('ticket_max_minor', { mode: 'bigint' }),
    ticketCurrency: text('ticket_currency'),
    acceptedInstruments: text('accepted_instruments').array().notNull(),
    patronageTypes: text('patronage_types').array().notNull(),
    mentoringAvailable: boolean('mentoring_available').notNull(),
    openToExpertMissions: boolean('open_to_expert_missions').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    check('contributor_facets_hats_check', sql`cardinality(${table.hats}) >= 1`),
    check(
      'contributor_facets_ticket_check',
      sql`${table.ticketMinMinor} is null or ${table.ticketMinMinor} <= ${table.ticketMaxMinor}`,
    ),
  ],
);
