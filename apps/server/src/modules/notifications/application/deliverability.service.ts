import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InboxService } from '../../../platform/inbox';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { MailSuppressionRegistry } from '../../../platform/mailer';
import { OutboxService } from '../../../platform/outbox';
import { IdentityFacade } from '../../identity';
import { EmailBounced, EmailComplained } from '../domain/notifications-events';
import { NotificationsRepository } from './ports';

/** What the email provider reported, from a verified webhook. */
export interface DeliveryReport {
  providerEventId: string;
  kind: 'bounce' | 'complaint';
  recipients: string[];
}

/**
 * Email deliverability (ADR 0062): permanent bounces and complaints reported by the provider
 * (Resend webhook, signed) suppress the address; the mailer asks this list before each email.
 */
@Injectable()
export class DeliverabilityService implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly suppressions: MailSuppressionRegistry,
    private readonly identity: IdentityFacade,
    private readonly inbox: InboxService,
    private readonly outbox: OutboxService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.suppressions.register({ suppressed: (emails) => this.notifications.suppressed(emails) });
  }

  /** Once per provider event (inbox), in one transaction with its events. */
  async report(report: DeliveryReport): Promise<'accepted' | 'duplicate'> {
    const result = await this.inbox.process('webhook:resend', report.providerEventId, async () => {
      const now = this.clock.now();
      for (const address of report.recipients) {
        const email = address.trim().toLowerCase();
        if (!(await this.notifications.suppress(email, report.kind, report.providerEventId, now))) {
          continue;
        }
        const user = await this.identity.findUserByEmail(email);
        const Event = report.kind === 'bounce' ? EmailBounced : EmailComplained;
        await this.outbox.record(
          new Event({
            id: this.ids.next(),
            aggregateId: this.ids.next(),
            occurredAt: now,
            payload: { recipientId: user?.id ?? null, providerEventId: report.providerEventId },
          }),
        );
      }
    });
    return result.status === 'processed' ? 'accepted' : 'duplicate';
  }
}
