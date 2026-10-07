import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullMQOtel } from 'bullmq-otel';
import { type CommonConfig, COMMON_CONFIG } from '../config';
import { QUEUE_NAMES } from './queue-names';
import { DEFAULT_JOB_OPTIONS } from './queue-options';

/** Workers and queues are closed by @nestjs/bullmq on application shutdown. */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [COMMON_CONFIG],
      useFactory: (config: CommonConfig) => ({
        connection: { url: config.redis.url, maxRetriesPerRequest: null },
        prefix: config.queue.prefix,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
        ...(config.otel.enabled ? { telemetry: new BullMQOtel({ tracerName: 'pitchorium' }) } : {}),
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.domainEvents }, { name: QUEUE_NAMES.maintenance }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
