import { Global, Module } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../config';
import { CdnCache, NoopCdnCache } from './cdn-cache';
import { CloudflareCdnCache } from './cloudflare-cdn-cache';

/** CDN purge, used by the worker only (CDN_PURGE_PROVIDER). */
@Global()
@Module({
  providers: [
    {
      provide: CdnCache,
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig): CdnCache =>
        config.cdn.provider === 'cloudflare'
          ? new CloudflareCdnCache(config.cdn.cloudflare)
          : new NoopCdnCache(),
    },
  ],
  exports: [CdnCache],
})
export class CdnModule {}
