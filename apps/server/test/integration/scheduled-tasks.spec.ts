import { getQueueToken } from '@nestjs/bullmq';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MediaModule } from '../../src/modules/media';
import { MEDIA_QUEUE } from '../../src/modules/media/interface/media-queue';
import { IdempotencyModule } from '../../src/platform/idempotency';
import { MaintenanceModule } from '../../src/platform/maintenance/maintenance.module';
import { QUEUE_NAMES } from '../../src/platform/queue';
import { StorageModule } from '../../src/platform/storage';
import { query } from './support/database';
import { createWorkerTestingModule } from './support/worker-testing-module';

const EVERY_MS = 300;

/**
 * Scheduled tasks are registered as BullMQ job schedulers when the worker starts, and BullMQ
 * runs them by itself: here every EVERY_MS instead of their cron pattern.
 */
describe('scheduled tasks', () => {
  let worker: TestingModule;

  beforeAll(async () => {
    worker = await createWorkerTestingModule(
      [],
      [StorageModule, IdempotencyModule, MaintenanceModule, MediaModule.forWorker()],
      (builder) => builder,
      { SCHEDULED_TASKS_EVERY_MS: String(EVERY_MS) },
    );
  });

  afterAll(async () => {
    // Later test files register the cron patterns again; nothing keeps firing meanwhile.
    for (const [name, keys] of [
      [MEDIA_QUEUE, ['delete-orphans', 'purge-deleted']],
      [QUEUE_NAMES.maintenance, ['purge-idempotency-keys']],
    ] as const) {
      const queue = worker.get<Queue>(getQueueToken(name));
      for (const key of keys) await queue.removeJobScheduler(key);
    }
    await worker.close();
  });

  it('registers every scheduled task with the configured interval', async () => {
    const schedulers = async (name: string) =>
      (await worker.get<Queue>(getQueueToken(name)).getJobSchedulers())
        .map((scheduler) => [scheduler.key, scheduler.every])
        .sort();
    expect(await schedulers(MEDIA_QUEUE)).toEqual([
      ['delete-orphans', EVERY_MS],
      ['purge-deleted', EVERY_MS],
    ]);
    expect(await schedulers(QUEUE_NAMES.maintenance)).toEqual([
      ['purge-idempotency-keys', EVERY_MS],
      ['purge-outbox', EVERY_MS],
    ]);
  });

  it('runs the tasks without any manual trigger', async () => {
    const orphanId = '0199a1b2-0000-7000-8000-000000000001';
    await query(
      `INSERT INTO media.assets (id, owner_id, usage, source, status, visibility,
         declared_content_type, declared_size, quarantine_key, moderation_status,
         unattached_since, created_at, updated_at)
       VALUES ($1, $1, 'post_image', 'upload', 'rejected', 'public', 'image/png', 10,
         $2, 'none', now() - interval '3 days', now(), now())`,
      [orphanId, `quarantine/${orphanId}`],
    );
    await query(
      `INSERT INTO platform.idempotency_keys (scope, key, request_fingerprint, created_at, expires_at)
       VALUES ('scheduled-test', 'expired', 'fingerprint', now() - interval '2 days',
         now() - interval '1 day')`,
    );

    await vi.waitFor(
      async () => {
        const [asset] = await query<{ status: string; purged_at: Date | null }>(
          'SELECT status, purged_at FROM media.assets WHERE id = $1',
          [orphanId],
        );
        // delete-orphans marks it deleted, then purge-deleted removes its objects.
        expect(asset).toMatchObject({ status: 'deleted' });
        expect(asset?.purged_at).not.toBeNull();
        const keys = await query(
          `SELECT 1 FROM platform.idempotency_keys WHERE scope = 'scheduled-test'`,
        );
        expect(keys).toHaveLength(0);
      },
      { timeout: 15_000, interval: 200 },
    );
  });
});
