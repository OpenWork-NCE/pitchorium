import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentModule } from '../../src/modules/content';
import { DiscoveryModule } from '../../src/modules/discovery';
import { EngagementModule } from '../../src/modules/engagement';
import { EventsModule } from '../../src/modules/events';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { MessagingModule } from '../../src/modules/messaging';
import { MissionsModule } from '../../src/modules/missions';
import { NetworkModule } from '../../src/modules/network';
import { NotificationsModule } from '../../src/modules/notifications';
import { NotificationsMaintenanceService } from '../../src/modules/notifications/application/notifications-maintenance.service';
import { NOTIFICATIONS_QUEUE } from '../../src/modules/notifications/interface/notifications-queue';
import { OrganizationsModule } from '../../src/modules/organizations';
import { PaymentsModule } from '../../src/modules/payments';
import { ProfilesModule } from '../../src/modules/profiles';
import { ProjectsModule } from '../../src/modules/projects';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { ObservabilityModule } from '../../src/platform/observability';
import { OutboxRelayService } from '../../src/platform/outbox';
import { QUEUE_NAMES } from '../../src/platform/queue';
import { RealtimePublisherModule } from '../../src/platform/realtime';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { Mailpit } from './support/mailpit';
import { entrepreneur, publishedProject } from './support/payments';
import { createWorkerTestingModule } from './support/worker-testing-module';

const FOLLOWERS = 5000;
const BATCH_SIZE = 500;
/**
 * Before batched delivery: 10 012 jobs (one per notification and one per email), 166 s on a
 * development machine (ADR 0064). Now about 8 jobs per batch of 500.
 */
const MAX_JOBS = 100;

const count = async (sql: string, params: unknown[] = []) =>
  Number((await query<{ count: string }>(sql, params))[0]?.count ?? 0);

/**
 * Delivery of one project update to 5 000 followers who all asked for its email (ADR 0064):
 * number of queue jobs and time until every notification is created, pushed and emailed.
 */
describe('notifications fan-out volume', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  const mailpit = new Mailpit();

  beforeAll(async () => {
    const env = { NOTIFICATIONS_FANOUT_BATCH_SIZE: String(BATCH_SIZE) };
    ({ app } = await createApiTestApp([], env));
    worker = await createWorkerTestingModule(
      [],
      [
        ObservabilityModule,
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        RealtimePublisherModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ProfilesModule.forWorker(),
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
        ContentModule.forWorker(),
        ImpactModule.forWorker(),
        ProjectsModule.forWorker(),
        PaymentsModule.forWorker(),
        EngagementModule.forWorker(),
        MessagingModule.forWorker(),
        EventsModule.forWorker(),
        MissionsModule.forWorker(),
        DiscoveryModule.forWorker(),
        NotificationsModule.forWorker(),
      ],
      (builder) => builder,
      env,
    );
    await truncateAllTables();
    await mailpit.clear();
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  it('creates, pushes and emails 5 000 notifications with few jobs, once each', async () => {
    const owner = await entrepreneur(app, 'owner@example.com', 'Ama Owusu');
    const project = await publishedProject(owner);
    await query(
      `INSERT INTO identity.users (id, name, email, email_verified, locale, created_at, updated_at)
       SELECT gen_random_uuid(), 'Follower ' || g, 'follower-' || g || '@example.com', true, 'fr',
         now(), now()
       FROM generate_series(1, $1::int) g`,
      [FOLLOWERS],
    );
    await query(
      `INSERT INTO network.follows (follower_id, target_type, target_id, origin, created_at)
       SELECT id, 'project', $1, 'manual', now() FROM identity.users
       WHERE email LIKE 'follower-%'`,
      [project.id],
    );
    await query(
      `INSERT INTO notifications.preferences (user_id, type, channel, enabled, updated_at)
       SELECT id, 'project_update', 'email', true, now() FROM identity.users
       WHERE email LIKE 'follower-%'`,
    );
    const relay = worker.get(OutboxRelayService);
    // Events of the set-up are handled before the measure starts.
    await vi.waitFor(
      async () => {
        await relay.relayBatch();
        expect(
          await count(`SELECT count(*) FROM platform.outbox_events WHERE published_at IS NULL`),
        ).toBe(0);
      },
      { timeout: 30_000, interval: 200 },
    );
    const queues = [QUEUE_NAMES.domainEvents, NOTIFICATIONS_QUEUE].map((name) =>
      worker.get<Queue>(getQueueToken(name), { strict: false }),
    );
    /** Jobs of the queues, scheduled tasks (job schedulers) left aside. */
    const jobs = async () => {
      let total = 0;
      for (const queue of queues) {
        const all = await queue.getJobs([
          'completed',
          'failed',
          'active',
          'waiting',
          'prioritized',
        ]);
        total += all.filter((job) => !job.repeatJobKey).length;
      }
      return total;
    };
    const drained = async () => {
      for (const queue of queues) {
        const counts = await queue.getJobCounts('active', 'waiting', 'prioritized');
        if (Object.values(counts).some((value) => value > 0)) return false;
      }
      return true;
    };
    await vi.waitFor(async () => expect(await drained()).toBe(true), { timeout: 30_000 });
    await mailpit.clear();
    const jobsBefore = await jobs();

    const started = performance.now();
    await owner.agent
      .post(`/v1/projects/${project.id}/updates`)
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Les pompes sont installées.' })
      .expect(201);
    const emailed = () =>
      count(
        `SELECT count(*) FROM notifications.notifications
         WHERE type = 'project_update' AND emailed_at IS NOT NULL`,
      );
    await vi.waitFor(
      async () => {
        await relay.relayBatch();
        expect(await emailed()).toBe(FOLLOWERS);
        expect(
          await count(`SELECT count(*) FROM platform.outbox_events WHERE published_at IS NULL`),
        ).toBe(0);
        expect(await drained()).toBe(true);
      },
      { timeout: 600_000, interval: 100 },
    );
    const durationMs = Math.round(performance.now() - started);
    const jobCount = (await jobs()) - jobsBefore;
    process.stdout.write(
      `[fan-out volume] ${FOLLOWERS} followers, batches of ${BATCH_SIZE}: ${jobCount} jobs, ${durationMs} ms\n`,
    );

    expect(
      await count(`SELECT count(*) FROM notifications.notifications WHERE type = 'project_update'`),
    ).toBe(FOLLOWERS);
    expect(await mailpit.count()).toBe(FOLLOWERS);
    expect(jobCount).toBeLessThanOrEqual(MAX_JOBS);

    // A batch resumed after a failure in its emails sends only those not marked as sent.
    const [batch] = await query<{ payload: { created: string[]; grown: string[] } }>(
      `SELECT payload FROM platform.outbox_events
       WHERE event_type = 'notifications.batch.created.v1' AND payload->>'type' = 'project_update'
       LIMIT 1`,
    );
    expect(batch!.payload.created).toHaveLength(BATCH_SIZE);
    await query(
      `UPDATE notifications.notifications SET emailed_at = NULL WHERE id = ANY($1::uuid[])`,
      [batch!.payload.created.slice(0, 50)],
    );
    await mailpit.clear();
    await worker.get(NotificationsMaintenanceService).deliverBatch(batch!.payload);
    expect(await mailpit.count()).toBe(50);
    expect(await emailed()).toBe(FOLLOWERS);
  }, 900_000);
});
