import { Inject, Injectable } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import { NotificationCreator } from './notification-creator';
import type { Fanout } from './notification-sources';
import { NotificationsRepository } from './ports';

const DAY_MS = 86_400_000;

/** One batch of a fan-out: the source, what to notify, and the last follower done. */
export interface FanoutJob {
  source: string;
  fanout: Fanout;
  afterFollowerId: string | null;
}

/**
 * Scheduled and batched work of the notifications (worker): fan-out to the followers of a
 * target by batches, daily profile views, retention.
 */
@Injectable()
export class NotificationsMaintenanceService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly creator: NotificationCreator,
    private readonly network: NetworkFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  /**
   * One batch of followers, in one transaction; returns the cursor of the next batch, null at
   * the end. A replayed batch delivers nothing twice (deliveries).
   */
  async fanoutBatch(job: FanoutJob): Promise<string | null> {
    const { fanout } = job;
    const size = this.config.notifications.fanoutBatchSize;
    const followers = await this.network.followerIds(
      fanout.followersOf.targetType,
      fanout.followersOf.targetId,
      job.afterFollowerId,
      size,
    );
    let recipients = followers;
    if (fanout.connectionsOf) {
      const connections = new Set(await this.network.connectionIds(fanout.connectionsOf));
      recipients = followers.filter((id) => connections.has(id));
    }
    await this.creator.deliver(job.source, {
      type: fanout.type,
      recipientIds: recipients,
      actorId: fanout.actorId,
      target: fanout.target,
      data: fanout.data ?? {},
    });
    return followers.length === size ? (followers.at(-1) ?? null) : null;
  }

  /**
   * Profile views of the previous UTC day (§10.2, §10.5): one notification per viewed member,
   * naming only the visitors who did not choose a private visit.
   */
  async profileViews(): Promise<number> {
    const day = new Date(this.clock.now().getTime() - DAY_MS).toISOString().slice(0, 10);
    let created = 0;
    let after: string | null = null;
    for (;;) {
      const views = await this.network.profileViewsOfDay(day, after, 500);
      for (const view of views) {
        created += await this.creator.deliver(`profile-views:${day}`, {
          type: 'profile_views',
          recipientIds: [view.viewedId],
          actorId: null,
          target: { type: 'profile_views', key: day },
          data: { day, count: view.total },
          extraActors: { ids: view.visibleViewerIds, count: view.total },
        });
      }
      if (views.length < 500) return created;
      after = views.at(-1)?.viewedId ?? null;
    }
  }

  /** Retention (NOTIFICATIONS_RETENTION_DAYS, provisional). */
  purge(): Promise<number> {
    const before = new Date(
      this.clock.now().getTime() - this.config.notifications.retentionDays * DAY_MS,
    );
    return this.transactions.run(() => this.notifications.purgeBefore(before));
  }
}
