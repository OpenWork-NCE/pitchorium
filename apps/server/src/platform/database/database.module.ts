import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDatabase, type DatabaseHandle } from '@pitchorium/db';
import { type CommonConfig, COMMON_CONFIG } from '../config';
import { DATABASE, DATABASE_HANDLE } from './database.tokens';
import { TransactionManager } from './transaction-manager';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_HANDLE,
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig): DatabaseHandle =>
        createDatabase({
          url: config.database.url,
          maxConnections: config.database.poolMax,
          applicationName: 'pitchorium-server',
        }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_HANDLE],
      useFactory: (handle: DatabaseHandle) => handle.db,
    },
    TransactionManager,
  ],
  exports: [DATABASE, DATABASE_HANDLE, TransactionManager],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.pool.end();
  }
}
