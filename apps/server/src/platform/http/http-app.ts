import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { ApiConfig } from '../config';
import { IDEMPOTENT_REPLAYED_HEADER } from '../idempotency';
import { Metrics } from '../observability';
import { httpMetricsMiddleware } from './http-metrics';
import { mountRawHttpHandlers } from './raw-http-handler';
import { REQUEST_ID_HEADER } from './request-id';

export const API_PREFIX = 'v1';

export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}

/** HTTP settings shared by main.api.ts and the HTTP tests. */
export function configureHttpApp(app: NestExpressApplication, config: ApiConfig): void {
  applyGlobalPrefix(app);
  app.set('trust proxy', config.http.trustProxyHops);
  app.disable('x-powered-by');
  // Swagger UI needs inline assets; it is only served outside production.
  app.use(helmet({ contentSecurityPolicy: config.http.swaggerEnabled ? false : undefined }));
  app.enableCors({
    origin: config.http.corsOrigins.length > 0 ? config.http.corsOrigins : false,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER, IDEMPOTENT_REPLAYED_HEADER, 'Retry-After'],
  });
  app.use(httpMetricsMiddleware(app.get(Metrics)));
  // Raw handlers (Better Auth) read the request stream themselves: they precede the body parsers.
  mountRawHttpHandlers(app);
  app.useBodyParser('json', { limit: '1mb' });
}
