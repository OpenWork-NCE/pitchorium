import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { type CommonConfig, COMMON_CONFIG } from '../config';
import { resolveRequestId } from '../http/request-id';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from './log-redaction';
import { ErrorReporter, NoopErrorReporter, SentryErrorReporter } from './error-reporter';
import { Metrics, OpenTelemetryMetrics } from './metrics';
import { shutdownTelemetry } from './telemetry';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: resolveRequestId,
          redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR },
          autoLogging: { ignore: (request) => request.url?.startsWith('/v1/health') ?? false },
          ...(config.env === 'development'
            ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
            : {}),
        },
      }),
    }),
  ],
  providers: [
    {
      provide: ErrorReporter,
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig): ErrorReporter =>
        config.sentry.dsn ? new SentryErrorReporter() : new NoopErrorReporter(),
    },
    { provide: Metrics, useClass: OpenTelemetryMetrics },
  ],
  exports: [ErrorReporter, Metrics],
})
export class ObservabilityModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}
