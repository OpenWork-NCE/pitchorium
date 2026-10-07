import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { type Database, outboxEvents } from '@pitchorium/db';
import { eq } from '@pitchorium/db/orm';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATABASE, TransactionManager } from '../../src/platform/database';
import { DomainEvent, IdGenerator } from '../../src/platform/kernel';
import {
  DomainEventDispatcher,
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
  OutboxOutsideTransactionError,
  OutboxRelayService,
  OutboxService,
} from '../../src/platform/outbox';
import { QUEUE_NAMES } from '../../src/platform/queue';
import { truncatePlatformTables } from './support/database';
import { createWorkerTestingModule } from './support/worker-testing-module';

class SomethingHappened extends DomainEvent<{ value: number }> {
  readonly type = 'tests.something.happened.v1';
  readonly aggregateType = 'something';

  constructor(id: string, aggregateId: string, value: number) {
    super({ id, aggregateId, occurredAt: new Date(), payload: { value } });
  }
}

@Injectable()
@DomainEventHandler({ name: 'tests.counter', eventTypes: ['tests.something.happened.v1'] })
class CountingHandler implements DomainEventSubscriber {
  readonly received: OutboxEnvelope[] = [];

  handle(event: OutboxEnvelope): Promise<void> {
    this.received.push(event);
    return Promise.resolve();
  }
}

describe('outbox', () => {
  let moduleRef: TestingModule;
  let outbox: OutboxService;
  let relay: OutboxRelayService;
  let transactions: TransactionManager;
  let handler: CountingHandler;
  let queue: Queue;
  let db: Database;
  let ids: IdGenerator;

  const newEvent = (value: number) => new SomethingHappened(ids.next(), ids.next(), value);
  const rowOf = async (id: string) =>
    (await db.select().from(outboxEvents).where(eq(outboxEvents.id, id)))[0];

  beforeAll(async () => {
    moduleRef = await createWorkerTestingModule([CountingHandler]);
    outbox = moduleRef.get(OutboxService);
    relay = moduleRef.get(OutboxRelayService);
    transactions = moduleRef.get(TransactionManager);
    handler = moduleRef.get(CountingHandler);
    queue = moduleRef.get<Queue>(getQueueToken(QUEUE_NAMES.domainEvents));
    db = moduleRef.get<Database>(DATABASE);
    ids = moduleRef.get(IdGenerator);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    await truncatePlatformTables();
    handler.received.length = 0;
  });

  it('only records events inside a transaction, and drops them on rollback', async () => {
    await expect(outbox.record(newEvent(1))).rejects.toBeInstanceOf(OutboxOutsideTransactionError);

    const event = newEvent(2);
    await expect(
      transactions.run(async () => {
        await outbox.record(event);
        throw new Error('business write failed');
      }),
    ).rejects.toThrow('business write failed');

    expect(await rowOf(event.id)).toBeUndefined();
  });

  it('publishes a committed event once, even when the relay resumes after a crash', async () => {
    const event = newEvent(42);
    await transactions.run(() => outbox.record(event));
    expect((await rowOf(event.id))?.publishedAt).toBeNull();

    expect(await relay.relayBatch()).toBe(1);
    expect((await rowOf(event.id))?.publishedAt).toBeInstanceOf(Date);
    await vi.waitFor(() => expect(handler.received).toHaveLength(1), { timeout: 10_000 });
    expect(handler.received[0]).toMatchObject({
      id: event.id,
      type: event.type,
      payload: { value: 42 },
    });

    // Crash between the enqueue and the commit: the row is still pending and is relayed again.
    await db.update(outboxEvents).set({ publishedAt: null }).where(eq(outboxEvents.id, event.id));
    expect(await relay.relayBatch()).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
    expect(jobs.filter((job) => job.id === event.id)).toHaveLength(1);
    expect(handler.received).toHaveLength(1);
    expect(await relay.relayBatch()).toBe(0);
  });

  it('runs each handler once per event when a job is delivered twice', async () => {
    const dispatcher = moduleRef.get(DomainEventDispatcher);
    const event = newEvent(7);
    const envelope: OutboxEnvelope = {
      id: event.id,
      type: event.type,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    };

    await dispatcher.dispatch(envelope);
    await dispatcher.dispatch(envelope);

    expect(dispatcher.handlersFor(event.type)).toEqual(['tests.counter']);
    expect(handler.received).toHaveLength(1);
  });
});
