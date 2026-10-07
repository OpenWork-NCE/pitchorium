import { Injectable } from '@nestjs/common';
import { SERVER_EVENTS } from '@pitchorium/contracts';
import { RealtimePublisher } from '../../../platform/realtime';
import { CountersService } from './counters.service';
import { NotificationEmailsService } from './notification-emails.service';
import { NotificationPresenter } from './notification-presenter';
import type { NotificationRecord } from './ports';

/**
 * Port: a delivery channel of the notifications (ADR 0060). `in_app` and `email` exist; a
 * `push` channel (mobile or web push) will implement the same port.
 */
export abstract class NotificationChannelAdapter {
  abstract readonly channel: 'in_app' | 'email' | 'push';
  /** `created` is false when an event grew an existing notification. */
  abstract deliver(notification: NotificationRecord, created: boolean): Promise<void>;
}

/** Injection token of the enabled channels. */
export const NOTIFICATION_CHANNEL_ADAPTERS = Symbol('NOTIFICATION_CHANNEL_ADAPTERS');

/** Pushes the notification and the counters to every device of the recipient. */
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

  async deliver(notification: NotificationRecord): Promise<void> {
    if (!notification.inApp) return;
    const [presented] = await this.presenter.present(notification.recipientId, [notification]);
    this.publisher.toUsers([notification.recipientId], SERVER_EVENTS.notification, {
      notification: presented,
    });
    await this.counters.push([notification.recipientId]);
  }
}

/** Sends the email of a new notification at once; grouped events never email again. */
@Injectable()
export class EmailChannel extends NotificationChannelAdapter {
  readonly channel = 'email' as const;

  constructor(private readonly emails: NotificationEmailsService) {
    super();
  }

  async deliver(notification: NotificationRecord, created: boolean): Promise<void> {
    if (created) await this.emails.immediate(notification);
  }
}
