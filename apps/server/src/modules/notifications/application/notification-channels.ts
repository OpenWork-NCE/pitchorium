import { Injectable } from '@nestjs/common';
import { SERVER_EVENTS } from '@pitchorium/contracts';
import { RealtimePublisher } from '../../../platform/realtime';
import { CountersService } from './counters.service';
import { inGroups } from './in-groups';
import { NotificationEmailsService } from './notification-emails.service';
import { NotificationPresenter } from './notification-presenter';
import type { NotificationRecord } from './ports';

/** Recipients presented at once while delivering a batch (database connections in use). */
const PARALLEL_RECIPIENTS = 8;

/**
 * Port: a delivery channel of the notifications (ADR 0060). `in_app` and `email` exist; a
 * `push` channel (mobile or web push) will implement the same port. A batch holds the
 * notifications of one source event for up to NOTIFICATIONS_FANOUT_BATCH_SIZE recipients
 * (ADR 0064).
 */
export abstract class NotificationChannelAdapter {
  abstract readonly channel: 'in_app' | 'email' | 'push';
  /** `created` holds the ids of the new notifications; the others grew by a grouped event. */
  abstract deliver(
    notifications: readonly NotificationRecord[],
    created: ReadonlySet<string>,
  ): Promise<void>;
}

/** Injection token of the enabled channels. */
export const NOTIFICATION_CHANNEL_ADAPTERS = Symbol('NOTIFICATION_CHANNEL_ADAPTERS');

/** Pushes each notification and the counters to every device of its recipient. */
@Injectable()
export class InAppChannel extends NotificationChannelAdapter {
  readonly channel = 'in_app' as const;

  constructor(
    private readonly publisher: RealtimePublisher,
    private readonly presenter: NotificationPresenter,
    private readonly counters: CountersService,
  ) {
    super();
  }

  async deliver(notifications: readonly NotificationRecord[]): Promise<void> {
    const shown = notifications.filter((notification) => notification.inApp);
    await inGroups(shown, PARALLEL_RECIPIENTS, async (notification) => {
      const [presented] = await this.presenter.present(notification.recipientId, [notification]);
      this.publisher.toUsers([notification.recipientId], SERVER_EVENTS.notification, {
        notification: presented,
      });
    });
    await this.counters.push(shown.map((notification) => notification.recipientId));
  }
}

/** Sends the emails of the new notifications together; grouped events never email again. */
@Injectable()
export class EmailChannel extends NotificationChannelAdapter {
  readonly channel = 'email' as const;

  constructor(private readonly emails: NotificationEmailsService) {
    super();
  }

  async deliver(
    notifications: readonly NotificationRecord[],
    created: ReadonlySet<string>,
  ): Promise<void> {
    await this.emails.immediate(
      notifications.filter((notification) => created.has(notification.id)),
    );
  }
}
