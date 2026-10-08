import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { DomainError } from '../../../platform/kernel';
import { repeatEvery } from '../../../platform/queue';
import { PaymentsFacade } from '../../payments';
import { NoticesService } from '../application/notices.service';
import { SignalsService } from '../application/signals.service';
import { SuspensionsService } from '../application/suspensions.service';
import { type NoticeJob, type RefundJob, TRUST_JOBS, TRUST_QUEUE } from './trust-queue';

/**
 * End of the suspensions (every 5 minutes), purge of the signal activity (04:20 UTC), refunds
 * of a frozen project and emails to notifiers without an account.
 */
@Processor(TRUST_QUEUE, { concurrency: 2 })
export class TrustJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrustJobsProcessor.name);

  constructor(
    @InjectQueue(TRUST_QUEUE) private readonly queue: Queue,
    private readonly suspensions: SuspensionsService,
    private readonly signals: SignalsService,
    private readonly notices: NoticesService,
    private readonly payments: PaymentsFacade,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    await this.queue.upsertJobScheduler(
      TRUST_JOBS.endSuspensions,
      repeatEvery('*/5 * * * *', every),
      { name: TRUST_JOBS.endSuspensions },
    );
    await this.queue.upsertJobScheduler(
      TRUST_JOBS.purgeActivity,
      repeatEvery('20 4 * * *', every),
      { name: TRUST_JOBS.purgeActivity },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case TRUST_JOBS.endSuspensions:
        await this.suspensions.endExpired();
        return;
      case TRUST_JOBS.purgeActivity:
        await this.signals.purge();
        return;
      case TRUST_JOBS.notice: {
        const data = job.data as NoticeJob;
        await this.notices.send(data.reportId, data.kind);
        return;
      }
      case TRUST_JOBS.refund: {
        const data = job.data as RefundJob;
        try {
          await this.payments.refundForModeration(data.contributionId, data.reason);
        } catch (error) {
          // Refunded meanwhile (a retried job, a refund by an administrator): nothing left.
          if (error instanceof DomainError && error.code === 'PAYMENTS_INVALID_TRANSITION') return;
          if (error instanceof DomainError && error.code === 'PAYMENTS_REFUND_INVALID') return;
          throw error;
        }
        return;
      }
      default:
        this.logger.warn(`Unknown trust job ${job.name}`);
    }
  }
}
