import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './modules/payments';
import { loadConfigOrExit, parseApiConfig } from './platform/config';

const DAY_MS = 86_400_000;

function daysArgument(): number {
  const index = process.argv.indexOf('--days');
  const days = index >= 0 ? Number(process.argv[index + 1]) : 3;
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    process.stderr.write('Usage: pnpm payments:reconcile [--days <1 to 3650>]\n');
    process.exit(2);
  }
  return days;
}

/**
 * Runs the payments reconciliation once (the worker runs it daily): provider transactions of
 * the last days against the contributions, the ledger and the project totals. Prints the
 * discrepancies and exits with 1 when there is one; corrects nothing.
 */
async function run(): Promise<void> {
  const days = daysArgument();
  loadConfigOrExit(parseApiConfig);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const report = await app.get(ReconciliationService, { strict: false }).run(days * DAY_MS);
    process.stdout.write(
      `Reconciliation ${report.runId}: ${report.checkedTransactions} provider transactions over ${days} days, ${report.discrepancies.length} discrepancies.\n`,
    );
    for (const discrepancy of report.discrepancies) {
      process.stdout.write(`- ${discrepancy.kind} ${discrepancy.reference}\n`);
    }
    if (report.discrepancies.length > 0) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
