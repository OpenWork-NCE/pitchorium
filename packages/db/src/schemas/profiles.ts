import { integer, pgSchema, text } from 'drizzle-orm/pg-core';

export const profilesSchema = pgSchema('profiles');

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
