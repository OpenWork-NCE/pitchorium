import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type ApiConfig, parseApiConfig, parseWorkerConfig, type WorkerConfig } from './config';
import { API_CONFIG, COMMON_CONFIG, WORKER_CONFIG } from './config.tokens';

/**
 * Configuration is parsed by provider factories so that tools creating the application graph
 * without running it (OpenAPI export) do not need a complete environment.
 */
@Global()
@Module({})
export class ConfigModule {
  static forApi(): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: API_CONFIG, useFactory: (): ApiConfig => parseApiConfig(process.env) },
        { provide: COMMON_CONFIG, useExisting: API_CONFIG },
      ],
      exports: [API_CONFIG, COMMON_CONFIG],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        { provide: WORKER_CONFIG, useFactory: (): WorkerConfig => parseWorkerConfig(process.env) },
        { provide: COMMON_CONFIG, useExisting: WORKER_CONFIG },
      ],
      exports: [WORKER_CONFIG, COMMON_CONFIG],
    };
  }
}
