import { Inject, Injectable } from '@nestjs/common';
import type { TrustSignalKind } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { CaseFilingService } from './case-filing.service';
import { TrustRepository } from './ports';

const DAY_MS = 86_400_000;
/** Longest window of a signal: activity older than this is purged. */
export const SIGNAL_RETENTION_MS = 7 * DAY_MS;

/**
 * Simple automatic signals (§13), without machine learning: an abnormal volume of message
 * requests out of network or of connection requests sent by an account, or of reports received
 * by an account. A signal opens a case on the profile in the moderation queue, never a
 * sanction.
 */
@Injectable()
export class SignalsService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly filing: CaseFilingService,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  /** Counts an activity once per source event; raises the signal at the threshold. */
  activity(
    kind: Extract<TrustSignalKind, 'message_requests' | 'connection_requests'>,
    userId: string,
    sourceEventId: string,
    occurredAt: Date,
  ): Promise<void> {
    return this.transactions.run(async () => {
      if (!(await this.trust.recordActivity({ sourceEventId, userId, kind, occurredAt }))) return;
      const threshold =
        kind === 'message_requests'
          ? this.config.trust.signals.messageRequestsPerDay
          : this.config.trust.signals.connectionRequestsPerDay;
      const since = new Date(this.clock.now().getTime() - DAY_MS);
      if ((await this.trust.countActivity(userId, kind, since)) >= threshold) {
        await this.raise(userId, kind);
      }
    });
  }

  /** After a report against a member, inside the transaction of the report. */
  async reportReceived(subjectId: string): Promise<void> {
    const since = new Date(this.clock.now().getTime() - 7 * DAY_MS);
    if (
      (await this.trust.countReportsAgainst(subjectId, since)) >=
      this.config.trust.signals.reportsReceivedPerWeek
    ) {
      await this.raise(subjectId, 'reports_received');
    }
  }

  purge(): Promise<number> {
    return this.trust.purgeActivity(new Date(this.clock.now().getTime() - SIGNAL_RETENTION_MS));
  }

  private async raise(userId: string, signal: TrustSignalKind): Promise<void> {
    await this.trust.lockTarget('profile', userId);
    const { created } = await this.filing.file({
      targetType: 'profile',
      targetId: userId,
      subjectId: userId,
      fundingActive: false,
      source: { kind: 'signal', signal },
    });
    if (created) this.metrics.increment('pitchorium.trust.signal.raised', { signal });
  }
}
