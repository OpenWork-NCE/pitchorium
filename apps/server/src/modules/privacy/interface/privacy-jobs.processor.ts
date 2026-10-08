import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { repeatEvery } from '../../../platform/queue';
import { ErasureExecutorService } from '../application/erasure-executor.service';
import { ExportBuilderService } from '../application/export-builder.service';
import { ExportRequested } from '../domain/privacy-events';
import { PRIVACY_JOBS, PRIVACY_QUEUE } from './privacy-queue';

/** An export requested becomes a job of the worker, which reads the committed request. */
@Injectable()
@DomainEventHandler({ name: 'privacy.exports', eventTypes: [ExportRequested.TYPE] })
export class ExportRequestedHandler implements DomainEventSubscriber {
  constructor(@InjectQueue(PRIVACY_QUEUE) private readonly queue: Queue) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    await this.queue.add(
      PRIVACY_JOBS.buildExport,
      { exportId: event.aggregateId },
      { jobId: `${PRIVACY_JOBS.buildExport}-${event.aggregateId}` },
    );
  }
}

/**
 * Builds the export archives, executes the erasures due (every 15 minutes), reminds the members
 * before their erasure (07:10 UTC) and deletes the expired archives (hourly).
 */
@Processor(PRIVACY_QUEUE, { concurrency: 1 })
export class PrivacyJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(PrivacyJobsProcessor.name);

  constructor(
    @InjectQueue(PRIVACY_QUEUE) private readonly queue: Queue,
    private readonly exports: ExportBuilderService,
    private readonly erasures: ErasureExecutorService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    const schedules: [string, string][] = [
      [PRIVACY_JOBS.executeErasures, '*/15 * * * *'],
      [PRIVACY_JOBS.remindErasures, '10 7 * * *'],
      [PRIVACY_JOBS.expireExports, '25 * * * *'],
    ];
    for (const [name, pattern] of schedules) {
      await this.queue.upsertJobScheduler(name, repeatEvery(pattern, every), { name });
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PRIVACY_JOBS.buildExport:
        // Only the last attempt of the queue marks the export failed: the others retry it.
        await this.exports.build((job.data as { exportId: string }).exportId, {
          lastAttempt: job.attemptsMade + 1 >= (job.opts.attempts ?? 1),
        });
        return;
      case PRIVACY_JOBS.executeErasures:
        await this.erasures.runDue();
        return;
      case PRIVACY_JOBS.remindErasures:
        await this.erasures.remind();
        return;
      case PRIVACY_JOBS.expireExports:
        await this.exports.expire();
        return;
      default:
        this.logger.warn(`Unknown privacy job ${job.name}`);
    }
  }
}
