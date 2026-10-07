import { createDatabase } from '../client.js';
import { FEATURE_FLAG_SEEDS, seedFeatureFlags } from '../seed.js';
import { requireDatabaseUrl } from './env.js';

const { db, pool } = createDatabase({
  url: requireDatabaseUrl(),
  applicationName: 'pitchorium-seed',
});
try {
  await seedFeatureFlags(db);
  process.stdout.write(`Seeded ${FEATURE_FLAG_SEEDS.length} feature flags.\n`);
} finally {
  await pool.end();
}
