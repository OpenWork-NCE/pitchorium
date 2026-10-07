import { type DynamicModule, Module } from '@nestjs/common';
import { AuditModule } from './audit';
import { ConfigModule } from './config';
import { CoreModule } from './core/core.module';
import { DatabaseModule } from './database';
import { FeatureFlagsModule } from './feature-flags';
import { HealthModule } from './health';
import { HttpModule } from './http';
import { IdempotencyModule } from './idempotency';
import { InboxModule } from './inbox';
import { MailerModule } from './mailer';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { ObservabilityModule } from './observability';
import { OutboxModule, OutboxRelayModule } from './outbox';
import { QueueModule } from './queue';
import { RealtimeModule } from './realtime';
import { RedisModule } from './redis';
import { StorageModule } from './storage';

/** Global technical services shared by the api and the worker. */
const SHARED_MODULES = [
  CoreModule,
  ObservabilityModule,
  DatabaseModule,
  RedisModule,
  OutboxModule,
  InboxModule,
  IdempotencyModule,
  StorageModule,
  MailerModule,
  FeatureFlagsModule,
  AuditModule,
];

@Module({})
export class PlatformModule {
  static forApi(): DynamicModule {
    return {
      module: PlatformModule,
      imports: [
        ConfigModule.forApi(),
        ...SHARED_MODULES,
        HttpModule,
        RealtimeModule,
        HealthModule.forApi(),
      ],
      exports: [RealtimeModule],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: PlatformModule,
      imports: [
        ConfigModule.forWorker(),
        ...SHARED_MODULES,
        QueueModule,
        OutboxRelayModule,
        MaintenanceModule,
        HealthModule.forWorker(),
      ],
    };
  }
}
