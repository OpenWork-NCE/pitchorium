import type { Provider } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '../../../src/platform/config';
import { CoreModule } from '../../../src/platform/core/core.module';
import { DatabaseModule } from '../../../src/platform/database';
import { InboxModule } from '../../../src/platform/inbox';
import { OutboxModule, OutboxRelayModule, OutboxRelayService } from '../../../src/platform/outbox';
import { RedisModule } from '../../../src/platform/redis';
import { useTestEnvironment } from './environment';

/**
 * Worker-side platform without the relay polling loop, so that tests drive relayBatch()
 * themselves.
 */
export async function createWorkerTestingModule(
  providers: Provider[] = [],
): Promise<TestingModule> {
  useTestEnvironment({ OUTBOX_POLL_INTERVAL_MS: '3600000' });
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forWorker(),
      CoreModule,
      DatabaseModule,
      RedisModule,
      InboxModule,
      OutboxModule,
      OutboxRelayModule,
    ],
    providers,
  }).compile();
  await moduleRef.init();
  await moduleRef.get(OutboxRelayService).beforeApplicationShutdown();
  return moduleRef;
}
