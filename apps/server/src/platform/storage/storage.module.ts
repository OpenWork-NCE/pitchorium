import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { type CommonConfig, COMMON_CONFIG } from '../config';
import { Clock } from '../kernel';
import { ObjectStorage } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';

@Global()
@Module({
  providers: [
    {
      provide: ObjectStorage,
      inject: [COMMON_CONFIG, Clock],
      useFactory: (config: CommonConfig, clock: Clock) =>
        new S3ObjectStorage(config.storage, clock),
    },
  ],
  exports: [ObjectStorage],
})
export class StorageModule implements OnApplicationShutdown {
  constructor(private readonly storage: ObjectStorage) {}

  onApplicationShutdown(): void {
    if (this.storage instanceof S3ObjectStorage) {
      this.storage.close();
    }
  }
}
