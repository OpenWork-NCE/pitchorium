import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { type CommonConfig, COMMON_CONFIG } from '../config';

export const REDIS = Symbol('REDIS');

/**
 * Commands fail fast while Redis is unreachable (no offline queue once connected, one retry):
 * a request answers an error in milliseconds instead of waiting for the reconnection
 * (docs/operations/resilience.md).
 */
export function createRedisClient(url: string, connectionName: string): Redis {
  const client = new Redis(url, { connectionName, maxRetriesPerRequest: 1 });
  client.once('ready', () => {
    client.options.enableOfflineQueue = false;
  });
  return client;
}

/** Shared client for commands (rate limiting, health). BullMQ and Socket.IO own their connections. */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig) =>
        createRedisClient(config.redis.url, 'pitchorium-server'),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
