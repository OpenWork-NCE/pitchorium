/**
 * Queue naming convention: `<owner>.<purpose>` in kebab-case, where owner is `platform` or a
 * business module name. Keys are prefixed in Redis with QUEUE_PREFIX.
 */
export const QUEUE_NAMES = {
  domainEvents: 'platform.domain-events',
  maintenance: 'platform.maintenance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
