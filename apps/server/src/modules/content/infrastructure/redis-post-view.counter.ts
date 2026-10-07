import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../../platform/redis';
import { PostViewCounter } from '../application/ports';

/** Keys live three days: today and yesterday are consolidated, the rest expires. */
const TTL_SECONDS = 3 * 86_400;

const viewersKey = (day: string, postId: string) => `content:post-views:${day}:${postId}`;
const postsKey = (day: string) => `content:post-views:posts:${day}`;

/**
 * One HyperLogLog per publication and day (about 12 kB at most, 0.81 % standard error), and the
 * set of publications seen that day for the consolidation task (ADR 0034).
 */
@Injectable()
export class RedisPostViewCounter extends PostViewCounter {
  private readonly logger = new Logger(RedisPostViewCounter.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  record(viewerId: string, postIds: readonly string[], day: string): void {
    if (postIds.length === 0) return;
    const pipeline = this.redis.pipeline();
    for (const postId of postIds) {
      pipeline
        .pfadd(viewersKey(day, postId), viewerId)
        .expire(viewersKey(day, postId), TTL_SECONDS);
    }
    pipeline.sadd(postsKey(day), ...postIds).expire(postsKey(day), TTL_SECONDS);
    pipeline
      .exec()
      .catch((error: unknown) => this.logger.warn(`Post views lost: ${String(error)}`));
  }

  postIdsSeen(day: string): Promise<string[]> {
    return this.redis.smembers(postsKey(day));
  }

  async count(day: string, postIds: readonly string[]): Promise<Map<string, number>> {
    const pipeline = this.redis.pipeline();
    for (const postId of postIds) pipeline.pfcount(viewersKey(day, postId));
    const results = (await pipeline.exec()) ?? [];
    return new Map(postIds.map((postId, index) => [postId, Number(results[index]?.[1] ?? 0)]));
  }
}
