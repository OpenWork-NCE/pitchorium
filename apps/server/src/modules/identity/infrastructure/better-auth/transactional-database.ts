import type { Database } from '@pitchorium/db';
import type { TransactionManager } from '../../../../platform/database';

/**
 * Database handle given to the Better Auth adapter. Every call is forwarded to the current
 * transaction of TransactionManager when there is one, so that Better Auth writes and the
 * outbox events recorded by its hooks commit together.
 */
export function transactionalDatabase(transactions: TransactionManager): Database {
  return new Proxy({} as Database, {
    get(_target, property) {
      const executor = transactions.executor as unknown as Record<PropertyKey, unknown>;
      const value = executor[property];
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(executor)
        : value;
    },
  });
}
