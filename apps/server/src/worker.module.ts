import { Module } from '@nestjs/common';
import { BUSINESS_MODULES } from './business-modules';
import { PlatformModule } from './platform/platform.module';

/** Root module of the worker process (queues, outbox relay, scheduled tasks). */
@Module({ imports: [PlatformModule.forWorker(), ...BUSINESS_MODULES] })
export class WorkerModule {}
