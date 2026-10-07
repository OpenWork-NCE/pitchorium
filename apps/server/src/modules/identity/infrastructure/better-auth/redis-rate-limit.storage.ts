import type { Redis } from 'ioredis';

// Fixed window: the first hit creates the counter with the window as TTL. Atomic in Redis.
const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { count, redis.call('TTL', KEYS[1]) }
`;

/** Better Auth rate limit counters in Redis, shared by every api instance. */
export class RedisRateLimitStorage {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'auth-rate-limit:',
  ) {}

  async consume(
    key: string,
    rule: { window: number; max: number },
  ): Promise<{ allowed: boolean; retryAfter: number | null }> {
    const [count, ttl] = (await this.redis.eval(
      CONSUME_SCRIPT,
      1,
      `${this.prefix}${rule.window}:${key}`,
      String(rule.window),
    )) as [number, number];
    return count <= rule.max
      ? { allowed: true, retryAfter: null }
      : { allowed: false, retryAfter: Math.max(ttl, 1) };
  }
}
