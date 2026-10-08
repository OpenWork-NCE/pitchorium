import type { TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import type { Notification } from '@pitchorium/contracts';
import { expect, vi } from 'vitest';
import { WORKER_BUSINESS_MODULES } from '../../../src/business-modules';
import { AuditModule } from '../../../src/platform/audit';
import { FeatureFlagsModule } from '../../../src/platform/feature-flags';
import { MailerModule } from '../../../src/platform/mailer';
import { ObservabilityModule } from '../../../src/platform/observability';
import { OutboxRelayService } from '../../../src/platform/outbox';
import { RealtimePublisherModule } from '../../../src/platform/realtime';
import { StorageModule } from '../../../src/platform/storage';
import type { Member } from './members';
import { createWorkerTestingModule } from './worker-testing-module';

/** The worker with every business module, as the worker process loads them. */
export function createFullWorker(
  environment: Record<string, string> = {},
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestingModule> {
  return createWorkerTestingModule(
    [],
    [
      ObservabilityModule,
      FeatureFlagsModule,
      AuditModule,
      MailerModule,
      StorageModule,
      RealtimePublisherModule,
      ...WORKER_BUSINESS_MODULES,
    ],
    configure,
    environment,
  );
}

/** Relays the outbox until the member has a notification of the type, then returns it. */
export function notificationOf(worker: TestingModule, member: Member, type: string) {
  return vi.waitFor(
    async () => {
      await worker.get(OutboxRelayService).relayBatch();
      const items = (
        (await member.agent.get('/v1/me/notifications').expect(200)).body as {
          items: Notification[];
        }
      ).items;
      const found = items.find((item) => item.type === type);
      expect(found, `${member.email} ${type}`).toBeDefined();
      return found!;
    },
    { timeout: 30_000, interval: 200 },
  );
}

/** Relays the outbox until it is empty (handlers of the worker included). */
export async function relayAll(worker: TestingModule): Promise<void> {
  const relay = worker.get(OutboxRelayService);
  for (let round = 0; round < 50; round += 1) {
    if ((await relay.relayBatch()) === 0) return;
  }
}
