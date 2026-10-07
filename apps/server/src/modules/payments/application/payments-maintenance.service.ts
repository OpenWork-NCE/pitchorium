import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ProjectsFacade } from '../../projects';
import { ContributionEffectsService } from './contribution-effects.service';
import { PaymentsRepository } from './ports';

const BATCH_SIZE = 100;
/** Grace after the expiry of a session, for a payment confirmed at the last second. */
export const EXPIRY_GRACE_MS = 2 * 60_000;

/** Scheduled tasks of the payments module (worker). */
@Injectable()
export class PaymentsMaintenanceService {
  private readonly logger = new Logger(PaymentsMaintenanceService.name);

  constructor(
    private readonly payments: PaymentsRepository,
    private readonly effects: ContributionEffectsService,
    private readonly projects: ProjectsFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Sessions past their expiry: the provider is asked first (a late success applies); still
   * unpaid, the contribution expires and its reward unit is released. A contribution whose
   * session was never created (crash between the two steps) expires the same way.
   */
  async expirePending(): Promise<number> {
    const now = this.clock.now();
    let expired = 0;
    const due = await this.payments.pendingExpiredBefore(
      new Date(now.getTime() - EXPIRY_GRACE_MS),
      BATCH_SIZE,
    );
    for (const candidate of due) {
      try {
        const synced = await this.effects.sync(candidate.id);
        if (synced?.status === 'expired') expired += 1;
        if (synced?.status !== 'pending_payment') continue;
      } catch (error) {
        this.logger.warn(`Provider unreachable for ${candidate.id}: ${String(error)}`);
        continue;
      }
      await this.transactions.run(async () => {
        const contribution = await this.payments.lockContribution(candidate.id);
        if (contribution?.status !== 'pending_payment') return;
        await this.effects.end(contribution, 'expired', 'session_expired');
        expired += 1;
      });
    }
    return expired;
  }

  /** Orphan reservations: an ended contribution whose reward unit was not released. */
  async releaseOrphanReservations(): Promise<number> {
    let released = 0;
    for (const contribution of await this.payments.heldRewardsOfEnded(BATCH_SIZE)) {
      await this.transactions.run(async () => {
        await this.projects.release(contribution.id);
        await this.payments.updateContribution(contribution.id, {
          rewardState: 'released',
          updatedAt: this.clock.now(),
        });
        released += 1;
      });
    }
    if (released > 0) this.logger.warn(`Released ${released} orphan reward reservations`);
    return released;
  }
}
