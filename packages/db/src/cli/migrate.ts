import { runMigrations } from '../migrate.js';
import { requireDatabaseUrl } from './env.js';

await runMigrations(requireDatabaseUrl());
process.stdout.write('Migrations applied.\n');
