import type { NestExpressApplication } from '@nestjs/platform-express';
import { SessionHandshakeGuard } from './modules/access';
import type { ApiConfig } from './platform/config';
import { configureHttpApp } from './platform/http';
import { RedisIoAdapter } from './platform/realtime';

/** HTTP and Socket.IO setup of the api, shared by main.api.ts and the integration tests. */
export function setupApiApp(app: NestExpressApplication, config: ApiConfig): void {
  configureHttpApp(app, config);
  app.useWebSocketAdapter(
    new RedisIoAdapter(
      app,
      config.redis.url,
      config.http.corsOrigins,
      app.get(SessionHandshakeGuard),
    ),
  );
}
