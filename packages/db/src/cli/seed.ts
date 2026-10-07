import { createDatabase } from '../client.js';
import { COUNTRY_SEEDS, FEATURE_FLAG_SEEDS, seedFeatureFlags, seedReferenceData } from '../seed.js';
import { requireDatabaseUrl } from './env.js';

const { db, pool } = createDatabase({
  url: requireDatabaseUrl(),
  applicationName: 'pitchorium-seed',
});
try {
  await seedFeatureFlags(db);
  process.stdout.write(`Seeded ${FEATURE_FLAG_SEEDS.length} feature flags.\n`);
  await seedReferenceData(db);
  process.stdout.write(`Seeded reference data (${COUNTRY_SEEDS.length} countries).\n`);
} finally {
  await pool.end();
}
