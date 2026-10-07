import { type DynamicModule, Module } from '@nestjs/common';
import type { DatabaseHandle } from '@pitchorium/db';
import type { Redis } from 'ioredis';
import { DATABASE_HANDLE } from '../database';
import { REDIS } from '../redis';
import { ObjectStorage } from '../storage';
import { HealthController } from './health.controller';
import { HEALTH_CHECKS, type HealthCheck, HealthService } from './health.service';
import { WorkerHealthServer } from './worker-health.server';

const postgresCheck =
  (handle: DatabaseHandle): HealthCheck =>
  () =>
    handle.pool.query('select 1');
const redisCheck =
  (redis: Redis): HealthCheck =>
  () =>
    redis.ping();

@Module({})
export class HealthModule {
  static forApi(): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: HEALTH_CHECKS,
          inject: [DATABASE_HANDLE, REDIS, ObjectStorage],
          useFactory: (handle: DatabaseHandle, redis: Redis, storage: ObjectStorage) => ({
            postgres: postgresCheck(handle),
            redis: redisCheck(redis),
            storage: () => storage.checkHealth(),
          }),
        },
      ],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: HealthModule,
      providers: [
        HealthService,
        WorkerHealthServer,
        {
          provide: HEALTH_CHECKS,
          inject: [DATABASE_HANDLE, REDIS],
          useFactory: (handle: DatabaseHandle, redis: Redis) => ({
            postgres: postgresCheck(handle),
            redis: redisCheck(redis),
          }),
        },
      ],
    };
  }
}
