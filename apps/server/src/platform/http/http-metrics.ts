import type { NextFunction, Request, Response } from 'express';
import type { Metrics } from '../observability';

export const HTTP_REQUESTS_METRIC = 'pitchorium.http.server.requests';
export const HTTP_DURATION_METRIC = 'pitchorium.http.server.duration';

/**
 * Counts every answered request and its duration in milliseconds, by method, route template
 * (never the concrete path, to bound the cardinality; `other` outside Nest routing: webhooks,
 * Better Auth, 404) and status class (`2xx` to `5xx`).
 */
export function httpMetricsMiddleware(metrics: Metrics) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    response.once('finish', () => {
      const route = (request.route as { path?: string } | undefined)?.path;
      const attributes = {
        method: request.method,
        route: route ?? 'other',
        status_class: `${Math.floor(response.statusCode / 100)}xx`,
      };
      metrics.increment(HTTP_REQUESTS_METRIC, attributes);
      metrics.record(
        HTTP_DURATION_METRIC,
        Number(process.hrtime.bigint() - started) / 1_000_000,
        attributes,
      );
    });
    next();
  };
}
