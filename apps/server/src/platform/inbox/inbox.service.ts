import { Injectable } from '@nestjs/common';
import { inboxMessages } from '@pitchorium/db';
import { and, eq, isNotNull, lt } from '@pitchorium/db/orm';
import { TransactionManager } from '../database';
import { Clock, IdGenerator } from '../kernel';

export type InboxResult<T> = { status: 'processed'; result: T } | { status: 'duplicate' };

/**
 * Deduplicates messages received from outside (webhooks) or from the outbox. The message is
 * recorded and processed in the same transaction: if processing fails, nothing is recorded and
 * a redelivery is processed again.
 */
@Injectable()
export class InboxService {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  process<T>(source: string, externalId: string, work: () => Promise<T>): Promise<InboxResult<T>> {
    return this.transactions.run(async (tx) => {
      // A concurrent delivery blocks on the unique index until this transaction ends.
      const inserted = await tx
        .insert(inboxMessages)
        .values({ id: this.ids.next(), source, externalId, receivedAt: this.clock.now() })
        .onConflictDoNothing({ target: [inboxMessages.source, inboxMessages.externalId] })
        .returning({ id: inboxMessages.id });
      if (inserted.length === 0) {
        return { status: 'duplicate' };
      }
      const result = await work();
      await tx
        .update(inboxMessages)
        .set({ processedAt: this.clock.now() })
        .where(and(eq(inboxMessages.source, source), eq(inboxMessages.externalId, externalId)));
      return { status: 'processed', result };
    });
  }

  /** Deletes the messages processed before the date, past any redelivery of their source. */
  async purgeProcessed(before: Date): Promise<number> {
    const deleted = await this.transactions.executor
      .delete(inboxMessages)
      .where(and(isNotNull(inboxMessages.processedAt), lt(inboxMessages.processedAt, before)))
      .returning({ id: inboxMessages.id });
    return deleted.length;
  }
}
