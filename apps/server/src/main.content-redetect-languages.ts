import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LanguageRedetectionService } from './modules/content';
import { loadConfigOrExit, parseApiConfig } from './platform/config';

/**
 * pnpm content:redetect-languages: detects again the language of the publications whose author
 * did not declare it, after a change of the detection (ADR 0169). Idempotent.
 */
async function run(): Promise<void> {
  loadConfigOrExit(parseApiConfig);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const result = await app.get(LanguageRedetectionService, { strict: false }).run();
    process.stdout.write(
      `Languages detected again: ${result.checked} publications, ${result.changed} changed.\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void run();
