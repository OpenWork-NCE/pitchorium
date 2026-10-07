import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { ContributionEffectsService } from '../application/contribution-effects.service';
import { PaymentsMaintenanceService } from '../application/payments-maintenance.service';
import { PayoutService } from '../application/payout.service';
import { ReconciliationService } from '../application/reconciliation.service';
import type { ProviderId } from '../domain/capability-matrix';
import {
  PAYMENTS_JOBS,
  PAYMENTS_QUEUE,
  type SyncContributionJob,
  type SyncPaymentReferenceJob,
  type SyncPayoutAccountJob,
} from './payments-queue';

/**
 * Reads of the providers after a notification (outside the inbox transaction, ADR 0019),
 * expiry of the sessions, release of orphan reservations and the daily reconciliation.
 */
@Processor(PAYMENTS_QUEUE)
export class PaymentsJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(PaymentsJobsProcessor.name);

  constructor(
    @InjectQueue(PAYMENTS_QUEUE) private readonly queue: Queue,
    private readonly effects: ContributionEffectsService,
    private readonly payout: PayoutService,
    private readonly maintenance: PaymentsMaintenanceService,
    private readonly reconciliation: ReconciliationService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    await this.queue.upsertJobScheduler(
      PAYMENTS_JOBS.expirePending,
      repeatEvery('*/5 * * * *', every),
      { name: PAYMENTS_JOBS.expirePending },
    );
    await this.queue.upsertJobScheduler(
      PAYMENTS_JOBS.releaseOrphans,
      repeatEvery('*/15 * * * *', every),
      { name: PAYMENTS_JOBS.releaseOrphans },
    );
    // Daily, at night (UTC); a fixed interval only replaces it in tests.
    await this.queue.upsertJobScheduler(
      PAYMENTS_JOBS.reconcile,
      every === undefined ? { pattern: '30 3 * * *' } : { every: Math.max(every, 60_000) },
      { name: PAYMENTS_JOBS.reconcile },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case PAYMENTS_JOBS.syncContribution: {
        const data = job.data as SyncContributionJob;
        await this.effects.sync(data.contributionId, data.providerPaymentId ?? null);
        return;
      }
      case PAYMENTS_JOBS.syncPayoutAccount: {
        const data = job.data as SyncPayoutAccountJob;
        await this.payout.refreshByProviderAccount(
          data.provider as ProviderId,
          data.providerAccountId,
        );
        return;
      }
      case PAYMENTS_JOBS.syncPaymentReference: {
        const data = job.data as SyncPaymentReferenceJob;
        await this.effects.syncByReference(data.provider as ProviderId, data.paymentReference);
        return;
      }
      case PAYMENTS_JOBS.expirePending:
        await this.maintenance.expirePending();
        return;
      case PAYMENTS_JOBS.releaseOrphans:
        await this.maintenance.releaseOrphanReservations();
        return;
      case PAYMENTS_JOBS.reconcile:
        await this.reconciliation.run(this.config.reconciliation.lookbackMs);
        return;
      default:
        this.logger.warn(`Unknown payments job ${job.name}`);
    }
  }
}
