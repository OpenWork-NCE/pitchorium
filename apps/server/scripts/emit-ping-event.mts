import { createDatabase, outboxEvents } from '@pitchorium/db';
import { v7 } from 'uuid';

/** Inserts a technical platform.ping.v1 event; a running worker relays it and logs it. */
const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL is not set');
}
const { db, pool } = createDatabase({ url, applicationName: 'pitchorium-outbox-ping' });
const id = v7();
const now = new Date();
await db.insert(outboxEvents).values({
  id,
  aggregateType: 'platform',
  aggregateId: v7(),
  eventType: 'platform.ping.v1',
  payload: { emittedAt: now.toISOString() },
  occurredAt: now,
  nextAttemptAt: now,
});
await pool.end();
process.stdout.write(`Outbox event platform.ping.v1 ${id} recorded.\n`);
