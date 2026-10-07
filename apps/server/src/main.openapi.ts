import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyGlobalPrefix } from './platform/http';
import { buildOpenApiDocument } from './platform/openapi';

const OUTPUT = resolve(__dirname, '../openapi/openapi.json');

/**
 * Preview mode builds the module graph without instantiating providers: no connection is
 * opened and no environment variable is needed.
 */
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  applyGlobalPrefix(app);
  const document = buildOpenApiDocument(app);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`OpenAPI document written to ${OUTPUT}\n`);
}

void generate();
