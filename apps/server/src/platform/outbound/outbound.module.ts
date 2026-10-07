import { Global, Module } from '@nestjs/common';
import { SafeHttpClient } from './safe-http-client';

/** The SSRF-protected client as a provider, so that tests can serve pages from loopback. */
@Global()
@Module({
  providers: [{ provide: SafeHttpClient, useFactory: () => new SafeHttpClient() }],
  exports: [SafeHttpClient],
})
export class OutboundModule {}
