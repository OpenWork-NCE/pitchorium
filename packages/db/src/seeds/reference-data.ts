import { sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { profilesCountries, profilesSectors, profilesStages } from '../schemas/profiles.js';
import { COUNTRY_SEEDS } from './countries.js';

/**
 * Provisional sector taxonomy: the 21 sections of ISIC Rev. 4 (UN standard), until the
 * prototype's list is provided (docs/open-questions.md). Labels: i18n `reference:sectors.<code>`.
 */
export const SECTOR_SEEDS: readonly { code: string; isicSection: string }[] = [
  { code: 'agriculture_forestry_fishing', isicSection: 'A' },
  { code: 'mining_quarrying', isicSection: 'B' },
  { code: 'manufacturing', isicSection: 'C' },
  { code: 'energy', isicSection: 'D' },
  { code: 'water_waste', isicSection: 'E' },
  { code: 'construction', isicSection: 'F' },
  { code: 'trade', isicSection: 'G' },
  { code: 'transport_storage', isicSection: 'H' },
  { code: 'accommodation_food', isicSection: 'I' },
  { code: 'information_communication', isicSection: 'J' },
  { code: 'finance_insurance', isicSection: 'K' },
  { code: 'real_estate', isicSection: 'L' },
  { code: 'professional_scientific_technical', isicSection: 'M' },
  { code: 'administrative_support', isicSection: 'N' },
  { code: 'public_administration', isicSection: 'O' },
  { code: 'education', isicSection: 'P' },
  { code: 'health_social_work', isicSection: 'Q' },
  { code: 'arts_entertainment_recreation', isicSection: 'R' },
  { code: 'other_services', isicSection: 'S' },
  { code: 'households', isicSection: 'T' },
  { code: 'extraterritorial_organizations', isicSection: 'U' },
];

/** Provisional company stages, to be validated (docs/open-questions.md). */
export const STAGE_SEEDS: readonly string[] = [
  'idea',
  'prototype',
  'early_revenue',
  'growth',
  'scale',
];

/**
 * Idempotent upsert. Reference data is owned by the code: values are refreshed, rows are never
 * deleted (profiles may reference them).
 */
export async function seedReferenceData(db: Database): Promise<void> {
  await db
    .insert(profilesCountries)
    .values(
      COUNTRY_SEEDS.map(([code, m49Region, m49SubRegion, m49IntermediateRegion]) => ({
        code,
        m49Region,
        m49SubRegion,
        m49IntermediateRegion,
      })),
    )
    .onConflictDoUpdate({
      target: profilesCountries.code,
      set: {
        m49Region: sql`excluded.m49_region`,
        m49SubRegion: sql`excluded.m49_sub_region`,
        m49IntermediateRegion: sql`excluded.m49_intermediate_region`,
      },
    });
  await db
    .insert(profilesSectors)
    .values(SECTOR_SEEDS.map((sector, position) => ({ ...sector, position })))
    .onConflictDoUpdate({
      target: profilesSectors.code,
      set: { isicSection: sql`excluded.isic_section`, position: sql`excluded.position` },
    });
  await db
    .insert(profilesStages)
    .values(STAGE_SEEDS.map((code, position) => ({ code, position })))
    .onConflictDoUpdate({ target: profilesStages.code, set: { position: sql`excluded.position` } });
}
