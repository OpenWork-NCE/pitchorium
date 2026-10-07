import { sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { featureFlags } from './schemas/platform.js';

export interface FeatureFlagSeed {
  key: string;
  enabled: boolean;
  description: string;
}

export const FEATURE_FLAG_SEEDS: readonly FeatureFlagSeed[] = [
  { key: 'locale.fr', enabled: true, description: 'French interface (source locale).' },
  { key: 'locale.en', enabled: true, description: 'English interface.' },
  {
    key: 'locale.sw',
    enabled: false,
    description: 'Swahili interface. Enable only after native human review.',
  },
  {
    key: 'locale.wo',
    enabled: false,
    description: 'Wolof interface. Enable only after native human review.',
  },
  {
    key: 'locale.ln',
    enabled: false,
    description: 'Lingala interface. Enable only after native human review.',
  },
  {
    key: 'funding.equity',
    enabled: false,
    description:
      'Equity funding. Enable only once the legal framework and a licensed partner are validated.',
  },
  {
    key: 'funding.loans',
    enabled: false,
    description:
      'Loans. Enable only once the legal framework and a licensed partner are validated.',
  },
];

/**
 * Idempotent: existing flags keep their current state, only descriptions are refreshed.
 */
export async function seedFeatureFlags(db: Database, now: Date = new Date()): Promise<void> {
  await db
    .insert(featureFlags)
    .values(FEATURE_FLAG_SEEDS.map((flag) => ({ ...flag, updatedAt: now })))
    .onConflictDoUpdate({
      target: featureFlags.key,
      set: { description: sql`excluded.description` },
    });
}

export { COUNTRY_SEEDS } from './seeds/countries.js';
export { SECTOR_SEEDS, seedReferenceData, STAGE_SEEDS } from './seeds/reference-data.js';
