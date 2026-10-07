import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

/** IdempotencyInterceptor is instantiated by Nest where @Idempotent() is used (API only). */
@Global()
@Module({ providers: [IdempotencyService], exports: [IdempotencyService] })
export class IdempotencyModule {}
