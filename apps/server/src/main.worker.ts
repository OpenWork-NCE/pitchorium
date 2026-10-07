import './platform/observability/instrument-worker';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { loadConfigOrExit, parseWorkerConfig } from './platform/config';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  loadConfigOrExit(parseWorkerConfig);
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // SIGTERM: stop the outbox relay, let BullMQ workers finish their jobs, then close resources.
  app.enableShutdownHooks();
  await app.init();
  app.get(Logger).log('Worker started');
}

void bootstrap();
