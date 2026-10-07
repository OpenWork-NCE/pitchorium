import { Inject, Injectable, Logger } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { Clock } from '../../../platform/kernel';
import { windowStart } from '../domain/profile-views';
import { NetworkRepository, ProfileViewBuffer } from './ports';

const BATCH_SIZE = 500;

/** Scheduled tasks of the network module (worker). */
@Injectable()
export class NetworkMaintenanceService {
  private readonly logger = new Logger(NetworkMaintenanceService.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    private readonly network: NetworkRepository,
    private readonly buffer: ProfileViewBuffer,
    private readonly clock: Clock,
  ) {}

  /** Closes the pending connection requests past their expiry. */
  async expireRequests(): Promise<number> {
    let total = 0;
    for (;;) {
      const expired = await this.network.expirePending(this.clock.now(), BATCH_SIZE);
      total += expired;
      if (expired < BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log(`Expired ${total} connection requests`);
    return total;
  }

  /**
   * Writes the buffered profile views in batches, with the private preference of each visitor
   * at that time. Views taken from the buffer and not written are lost (tolerated, ADR 0030).
   */
  async flushProfileViews(): Promise<number> {
    let written = 0;
    for (;;) {
      const views = await this.buffer.drain(BATCH_SIZE);
      if (views.length === 0) break;
      const privateViewers = await this.network.privateViewers(views.map((view) => view.viewerId));
      written += await this.network.insertProfileViews(
        views.map((view) => ({
          viewedId: view.viewedId,
          day: view.day,
          viewerId: view.viewerId,
          viewedAt: new Date(view.at),
          private: privateViewers.has(view.viewerId),
        })),
      );
      if (views.length < BATCH_SIZE) break;
    }
    return written;
  }

  /** Deletes the views older than NETWORK_PROFILE_VIEWS_RETENTION_DAYS. */
  async purgeProfileViews(): Promise<number> {
    const purged = await this.network.purgeProfileViewsBefore(
      windowStart(this.clock.now(), this.config.network.profileViewsRetentionDays),
    );
    if (purged > 0) this.logger.log(`Purged ${purged} profile views`);
    return purged;
  }
}
