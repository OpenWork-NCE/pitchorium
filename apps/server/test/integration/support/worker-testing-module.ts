import type { DynamicModule, Provider, Type } from '@nestjs/common';
import { Test, type TestingModule, type TestingModuleBuilder } from '@nestjs/testing';
import { ConfigModule } from '../../../src/platform/config';
import { CoreModule } from '../../../src/platform/core/core.module';
import { DatabaseModule } from '../../../src/platform/database';
import { InboxModule } from '../../../src/platform/inbox';
import { OutboundModule } from '../../../src/platform/outbound';
import { OutboxModule, OutboxRelayModule, OutboxRelayService } from '../../../src/platform/outbox';
import { RedisModule } from '../../../src/platform/redis';
import { LocalizationModule } from '../../../src/modules/localization';
import { PrivacyModule } from '../../../src/modules/privacy';
import { CdnModule } from '../../../src/platform/storage';
import { truncateAllTables } from './database';
import { useTestEnvironment } from './environment';

/**
 * Worker-side platform without the relay polling loop, so that tests drive relayBatch()
 * themselves.
 */
export async function createWorkerTestingModule(
  providers: Provider[] = [],
  imports: (Type | DynamicModule)[] = [],
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
  environment: Record<string, string> = {},
): Promise<TestingModule> {
  useTestEnvironment({ OUTBOX_POLL_INTERVAL_MS: '3600000', ...environment });
  // The relay runs one batch at startup: events left by a previous test file must not reach the
  // handlers while the next test truncates the tables.
  await truncateAllTables();
  // Business modules register their personal data and translatable sources: a partial
  // assembly gets the registries, unless the full modules are there.
  const full = imports.some(
    (entry) =>
      'module' in entry && (entry.module === PrivacyModule || entry.module === LocalizationModule),
  );
  const registrations =
    imports.length > 0 && !full
      ? [PrivacyModule.forRegistrations(), LocalizationModule.forRegistrations()]
      : [];
  const moduleRef = await configure(
    Test.createTestingModule({
      imports: [
        ConfigModule.forWorker(),
        CoreModule,
        DatabaseModule,
        RedisModule,
        InboxModule,
        OutboxModule,
        OutboxRelayModule,
        OutboundModule,
        CdnModule,
        ...registrations,
        ...imports,
      ],
      providers,
    }),
  ).compile();
  await moduleRef.init();
  await moduleRef.get(OutboxRelayService).beforeApplicationShutdown();
  return moduleRef;
}
