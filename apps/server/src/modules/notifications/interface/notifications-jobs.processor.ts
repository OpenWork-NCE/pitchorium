import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { repeatEvery } from '../../../platform/queue';
import { NotificationEmailsService } from '../application/notification-emails.service';
import {
  type DeliverJob,
  type FanoutJob,
  NotificationsMaintenanceService,
} from '../application/notifications-maintenance.service';
import { NOTIFICATIONS_JOBS, NOTIFICATIONS_QUEUE } from './notifications-queue';

/**
 * Fan-out batches (each enqueues the next one), delivery of the batches (push and grouped
 * emails, ADR 0064), unread message emails (every minute), digests
 * (every 15 minutes, each member at their local hour), profile views of the previous day
 * (05:10 UTC), event reminders (every 15 minutes), new suggestions of the previous day
 * (06:20 UTC) and retention (04:40 UTC).
 */
@Processor(NOTIFICATIONS_QUEUE, { concurrency: 4 })
export class NotificationsJobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsJobsProcessor.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly maintenance: NotificationsMaintenanceService,
    private readonly emails: NotificationEmailsService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.scheduledTasks.everyMs;
    const schedules: [string, string][] = [
      [NOTIFICATIONS_JOBS.unreadMessageEmails, '* * * * *'],
      [NOTIFICATIONS_JOBS.digests, '*/15 * * * *'],
      [NOTIFICATIONS_JOBS.profileViews, '10 5 * * *'],
      [NOTIFICATIONS_JOBS.purge, '40 4 * * *'],
      [NOTIFICATIONS_JOBS.eventReminders, '*/15 * * * *'],
      [NOTIFICATIONS_JOBS.newSuggestions, '20 6 * * *'],
    ];
    for (const [name, pattern] of schedules) {
      await this.queue.upsertJobScheduler(name, repeatEvery(pattern, every), { name });
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATIONS_JOBS.fanout: {
        const data = job.data as FanoutJob;
        const next = await this.maintenance.fanoutBatch(data);
        if (next) {
          await this.queue.add(
            NOTIFICATIONS_JOBS.fanout,
            { ...data, afterFollowerId: next } satisfies FanoutJob,
            { jobId: `${NOTIFICATIONS_JOBS.fanout}-${data.source.replaceAll(':', '-')}-${next}` },
          );
        }
        return;
      }
      case NOTIFICATIONS_JOBS.deliver:
        await this.maintenance.deliverBatch(job.data as DeliverJob);
        return;
      case NOTIFICATIONS_JOBS.unreadMessageEmails:
        await this.emails.unreadCopies();
        return;
      case NOTIFICATIONS_JOBS.digests:
        await this.emails.digests();
        return;
      case NOTIFICATIONS_JOBS.profileViews:
        await this.maintenance.profileViews();
        return;
      case NOTIFICATIONS_JOBS.eventReminders:
        await this.maintenance.eventReminders();
        return;
      case NOTIFICATIONS_JOBS.newSuggestions:
        await this.maintenance.newSuggestions();
        return;
      case NOTIFICATIONS_JOBS.purge:
        await this.maintenance.purge();
        return;
      default:
        this.logger.warn(`Unknown notifications job ${job.name}`);
    }
  }
}
