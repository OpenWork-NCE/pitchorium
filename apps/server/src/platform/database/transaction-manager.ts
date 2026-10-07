import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@pitchorium/db';
import { DATABASE } from './database.tokens';

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
export type Executor = Database | Transaction;

/**
 * Exposes the current transaction to repositories, the outbox and the audit log through
 * AsyncLocalStorage, so that a use case can wrap several writes in one transaction without
 * passing the transaction around.
 */
@Injectable()
export class TransactionManager {
  private readonly storage = new AsyncLocalStorage<Transaction>();

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** The current transaction, or the pool outside of one. */
  get executor(): Executor {
    return this.storage.getStore() ?? this.db;
  }

  get inTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  /** Nested calls join the outer transaction. */
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    const current = this.storage.getStore();
    if (current) {
      return work(current);
    }
    return this.db.transaction((tx) => this.storage.run(tx, () => work(tx)));
  }
}
