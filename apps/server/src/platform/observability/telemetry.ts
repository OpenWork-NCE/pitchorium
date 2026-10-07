import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';
import * as Sentry from '@sentry/node';

let sdk: NodeSDK | undefined;

/**
 * Traces and metrics (OTLP exporters by default, see OTEL_METRICS_EXPORTER) are enabled with
 * OTEL_EXPORTER_OTLP_ENDPOINT. Must run before any instrumented library is loaded, hence the
 * instrument-*.ts files imported first by the entry points. Reads the raw environment because
 * configuration validation has not run yet; the same variables are validated afterwards.
 */
export function startTelemetry(serviceName: string): void {
  const env = process.env;
  if (env['SENTRY_DSN']) {
    Sentry.init({
      dsn: env['SENTRY_DSN'],
      environment: env['SENTRY_ENVIRONMENT'] ?? env['NODE_ENV'] ?? 'development',
      serverName: serviceName,
    });
  }
  if (env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
    sdk = new NodeSDK({
      serviceName: env['OTEL_SERVICE_NAME'] ?? serviceName,
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
        new NestInstrumentation(),
        new PgInstrumentation(),
        new IORedisInstrumentation(),
      ],
    });
    sdk.start();
  }
}

export async function shutdownTelemetry(): Promise<void> {
  await Promise.allSettled([sdk?.shutdown(), Sentry.close(2000)]);
}
