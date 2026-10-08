import { runMigrations } from '@pitchorium/db';
import { loadConfigOrExit, parseWorkerConfig } from './platform/config';

/**
 * Release task of a deployment (`node dist/main.migrate.js`, the `migrate` command of the
 * image): applies the pending migrations once, before the api and the worker start
 * (docs/operations/deployment.md, rule expand and contract).
 */
async function run(): Promise<void> {
  const config = loadConfigOrExit(parseWorkerConfig);
  await runMigrations(config.database.url);
  process.stdout.write('Migrations applied.\n');
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
