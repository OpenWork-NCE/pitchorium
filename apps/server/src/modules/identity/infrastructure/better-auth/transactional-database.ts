import type { Database } from '@pitchorium/db';
import type { Transaction, TransactionManager } from '../../../../platform/database';

/**
 * Database handle given to the Better Auth adapter. Queries go to the current transaction of
 * TransactionManager when there is one, and to the pool otherwise; the transactions Better Auth
 * opens itself become TransactionManager transactions, so that the outbox joins them.
 */
export function transactionalDatabase(transactions: TransactionManager): Database {
  return new Proxy({} as Database, {
    get(_target, property) {
      if (property === 'transaction') {
        return <T>(work: (tx: Transaction) => Promise<T>) => transactions.run(work);
      }
      const executor = transactions.executor as unknown as Record<PropertyKey, unknown>;
      const value = executor[property];
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(executor)
        : value;
    },
  });
}
