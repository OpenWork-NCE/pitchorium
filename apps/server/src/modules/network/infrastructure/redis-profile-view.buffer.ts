import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../platform/redis';
import { type BufferedProfileView, ProfileViewBuffer } from '../application/ports';

const QUEUE_KEY = 'network:profile-views:buffer';
/** A marker outlives its day by one more day, so that late writes are still deduplicated. */
const DEDUPLICATION_TTL_SECONDS = 2 * 86_400;

/**
 * Pushes a view once per visitor, member and day, in one round trip: the marker is set only if
 * absent, and only then the view is queued.
 */
const PUSH_ONCE = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', ARGV[1]) then
  redis.call('RPUSH', KEYS[2], ARGV[2])
end
return 1
`;

@Injectable()
export class RedisProfileViewBuffer extends ProfileViewBuffer {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async push(view: BufferedProfileView): Promise<void> {
    const marker = `network:profile-views:seen:${view.day}:${view.viewerId}:${view.viewedId}`;
    await this.redis.eval(
      PUSH_ONCE,
      2,
      marker,
      QUEUE_KEY,
      String(DEDUPLICATION_TTL_SECONDS),
      JSON.stringify(view),
    );
  }

  async drain(max: number): Promise<BufferedProfileView[]> {
    const items = await this.redis.lpop(QUEUE_KEY, max);
    return (items ?? []).map((item) => JSON.parse(item) as BufferedProfileView);
  }
}
