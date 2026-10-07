import { Injectable } from '@nestjs/common';
import { outboxEvents } from '@pitchorium/db';
import { TransactionManager } from '../database';
import { type DomainEvent, isValidEventType } from '../kernel';

export class OutboxOutsideTransactionError extends Error {
  constructor() {
    super('Domain events must be recorded inside TransactionManager.run()');
    this.name = 'OutboxOutsideTransactionError';
  }
}

@Injectable()
export class OutboxService {
  constructor(private readonly transactions: TransactionManager) {}

  /**
   * Writes events in the current transaction, so they exist if and only if the business
   * write commits. Publication is done asynchronously by the worker relay.
   */
  async record(...events: DomainEvent[]): Promise<void> {
    if (!this.transactions.inTransaction) {
      throw new OutboxOutsideTransactionError();
    }
    if (events.length === 0) return;
    for (const event of events) {
      if (!isValidEventType(event.type)) {
        throw new Error(`Invalid domain event type: ${event.type}`);
      }
    }
    await this.transactions.executor.insert(outboxEvents).values(
      events.map((event) => ({
        id: event.id,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.type,
        payload: event.payload,
        occurredAt: event.occurredAt,
        nextAttemptAt: event.occurredAt,
      })),
    );
  }
}
