import { InjectQueue } from '@nestjs/bullmq';
import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { type Database, outboxEvents } from '@pitchorium/db';
import type { Queue } from 'bullmq';
import { and, asc, eq, inArray, isNull, lte, sql } from '@pitchorium/db/orm';
import { WORKER_CONFIG, type WorkerConfig } from '../config';
import { DATABASE } from '../database';
import { Clock } from '../kernel';
import { QUEUE_NAMES } from '../queue';
import type { OutboxEnvelope } from './outbox-envelope';

const BASE_BACKOFF_MS = 1000;

export function computeBackoffMs(attempts: number, maxBackoffMs: number): number {
  return Math.min(maxBackoffMs, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Publishes pending outbox rows to BullMQ. Rows are locked with FOR UPDATE SKIP LOCKED so that
 * several workers can relay in parallel; the job id is the event id, so a row published twice
 * (crash between enqueue and commit) produces a single job while the job is retained.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private running = false;
  private loop: Promise<void> | undefined;
  private wakeUp: (() => void) | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @InjectQueue(QUEUE_NAMES.domainEvents) private readonly queue: Queue<OutboxEnvelope>,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    this.loop = this.runLoop();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.running = false;
    this.wakeUp?.();
    await this.loop;
  }

  /** Relays one batch and returns the number of rows handled. */
  async relayBatch(): Promise<number> {
    const { batchSize, maxBackoffMs } = this.config.outbox;
    return this.db.transaction(async (tx) => {
      const now = this.clock.now();
      const rows = await tx
        .select()
        .from(outboxEvents)
        .where(and(isNull(outboxEvents.publishedAt), lte(outboxEvents.nextAttemptAt, now)))
        .orderBy(asc(outboxEvents.occurredAt))
        .limit(batchSize)
        .for('update', { skipLocked: true });

      const published: string[] = [];
      for (const row of rows) {
        const envelope: OutboxEnvelope = {
          id: row.id,
          type: row.eventType,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          occurredAt: row.occurredAt.toISOString(),
          payload: row.payload as OutboxEnvelope['payload'],
        };
        try {
          await this.queue.add(row.eventType, envelope, { jobId: row.id });
          published.push(row.id);
        } catch (error) {
          const attempts = row.attempts + 1;
          await tx
            .update(outboxEvents)
            .set({
              attempts,
              lastError: error instanceof Error ? error.message : String(error),
              nextAttemptAt: new Date(now.getTime() + computeBackoffMs(attempts, maxBackoffMs)),
            })
            .where(eq(outboxEvents.id, row.id));
          this.logger.warn(`Outbox event ${row.id} not published (attempt ${attempts})`);
        }
      }

      if (published.length > 0) {
        await tx
          .update(outboxEvents)
          .set({ publishedAt: now, attempts: sql`${outboxEvents.attempts} + 1`, lastError: null })
          .where(inArray(outboxEvents.id, published));
      }
      return rows.length;
    });
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      let handled = 0;
      try {
        handled = await this.relayBatch();
      } catch (error) {
        this.logger.error(error, 'Outbox relay batch failed');
      }
      if (this.running && handled < this.config.outbox.batchSize) {
        await this.sleep(this.config.outbox.pollIntervalMs);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.wakeUp = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      this.wakeUp = undefined;
    });
  }
}
