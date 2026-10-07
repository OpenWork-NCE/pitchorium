import './platform/observability/instrument-api';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadConfigOrExit, parseApiConfig } from './platform/config';
import { configureHttpApp } from './platform/http';
import { setupSwaggerUi } from './platform/openapi';
import { RealtimeHandshakeGuard, RedisIoAdapter } from './platform/realtime';

async function bootstrap(): Promise<void> {
  const config = loadConfigOrExit(parseApiConfig);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureHttpApp(app, config);
  app.useWebSocketAdapter(
    new RedisIoAdapter(
      app,
      config.redis.url,
      config.http.corsOrigins,
      app.get(RealtimeHandshakeGuard),
    ),
  );
  if (config.http.swaggerEnabled) {
    setupSwaggerUi(app);
  }
  // SIGTERM: stop accepting connections, finish in-flight requests, then close resources.
  app.enableShutdownHooks();
  await app.listen(config.http.port, config.http.host);
  app.get(Logger).log(`API listening on ${config.http.host}:${config.http.port}`);
}

void bootstrap();
