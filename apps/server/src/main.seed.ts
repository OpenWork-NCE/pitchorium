import { createDatabase, seedFeatureFlags, seedReferenceData } from '@pitchorium/db';
import { loadConfigOrExit, parseWorkerConfig } from './platform/config';

/**
 * Feature flags and reference data (`dist/main.seed.js`, the `seed` command of the image), as
 * `pnpm db:seed`: idempotent, a flag keeps its state once created.
 */
async function run(): Promise<void> {
  const config = loadConfigOrExit(parseWorkerConfig);
  const { db, pool } = createDatabase({
    url: config.database.url,
    applicationName: 'pitchorium-seed',
  });
  try {
    await seedFeatureFlags(db);
    await seedReferenceData(db);
    process.stdout.write('Feature flags and reference data seeded.\n');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
