import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, DiscoveryModule } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { ZodSerializerInterceptor } from 'nestjs-zod';
import { API_CONFIG, type ApiConfig } from '../config';
import { REDIS } from '../redis';
import { HttpThrottlerGuard } from './http-throttler.guard';
import { ProblemDetailsFilter } from './problem-details.filter';
import { StrictValidationPipe } from './strict-validation.pipe';

@Module({
  imports: [
    DiscoveryModule,
    ThrottlerModule.forRootAsync({
      inject: [API_CONFIG, REDIS],
      useFactory: (config: ApiConfig, redis: Redis) => ({
        throttlers: [{ ttl: config.rateLimit.ttlMs, limit: config.rateLimit.limit }],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  providers: [
    { provide: APP_PIPE, useClass: StrictValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
  ],
})
export class HttpModule {}
