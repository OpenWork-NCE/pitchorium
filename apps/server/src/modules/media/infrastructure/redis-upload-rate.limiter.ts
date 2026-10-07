import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { Clock } from '../../../platform/kernel';
import { REDIS } from '../../../platform/redis';
import { UploadRateLimiter } from '../application/ports';

const WINDOW_SECONDS = 3600;

/** Fixed one-hour window per member, shared by every api instance through Redis. */
@Injectable()
export class RedisUploadRateLimiter extends UploadRateLimiter {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly clock: Clock,
  ) {
    super();
  }

  async consume(ownerId: string): Promise<boolean> {
    const window = Math.floor(this.clock.now().getTime() / 1000 / WINDOW_SECONDS);
    const key = `media:upload-requests:${ownerId}:${window}`;
    const [[, count]] = (await this.redis.multi().incr(key).expire(key, WINDOW_SECONDS).exec()) as [
      [Error | null, number],
      [Error | null, number],
    ];
    return count <= this.config.media.uploadRequestsPerHour;
  }
}
