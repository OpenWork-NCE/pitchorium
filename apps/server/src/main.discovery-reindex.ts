import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IndexMaintenanceService } from './modules/discovery';
import { loadConfigOrExit, parseApiConfig } from './platform/config';

/**
 * pnpm discovery:reindex: rebuilds the search projection from the facades of the modules, then
 * every suggestion (ADR 0065). With --check, compares the projection with the sources, repairs
 * what differs and exits with 1 when it found a drift.
 */
async function run(): Promise<void> {
  const check = process.argv.includes('--check');
  loadConfigOrExit(parseApiConfig);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const maintenance = app.get(IndexMaintenanceService, { strict: false });
    if (check) {
      const report = await maintenance.checkDrift();
      process.stdout.write(
        `Drift check: ${report.checked} sources, ${report.missing} missing, ${report.stale} stale, ${report.orphaned} orphaned.\n`,
      );
      if (report.kinds.length > 0) process.exitCode = 1;
    } else {
      const result = await maintenance.rebuild();
      process.stdout.write(
        `Reindexed ${result.indexed} sources (${result.removed} removed), suggestions of ${result.subjects} subjects recomputed.\n`,
      );
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
