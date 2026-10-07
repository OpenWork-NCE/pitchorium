import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  DomainEventHandler,
  type DomainEventSubscriber,
  type OutboxEnvelope,
} from '../../../platform/outbox';
import { MessageSent } from '../../messaging';
import {
  NOTIFICATION_CHANNEL_ADAPTERS,
  type NotificationChannelAdapter,
} from '../application/notification-channels';
import { NotificationCreator } from '../application/notification-creator';
import { NotificationEmailsService } from '../application/notification-emails.service';
import { NotificationSources, SOURCE_EVENT_TYPES } from '../application/notification-sources';
import type { FanoutJob } from '../application/notifications-maintenance.service';
import { NotificationsRepository } from '../application/ports';
import { NotificationCreated } from '../domain/notifications-events';
import { NOTIFICATIONS_JOBS, NOTIFICATIONS_QUEUE } from './notifications-queue';

/**
 * Creates the notifications of a source event (ADR 0059): direct recipients in the inbox
 * transaction of the event, followers by batches in the worker queue. A message also waits
 * for its email copy (§10.4).
 */
@Injectable()
@DomainEventHandler({ name: 'notifications.create', eventTypes: SOURCE_EVENT_TYPES })
export class NotificationSourcesHandler implements DomainEventSubscriber {
  constructor(
    private readonly sources: NotificationSources,
    private readonly creator: NotificationCreator,
    private readonly emails: NotificationEmailsService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const { dispatches, fanouts } = await this.sources.resolve(event);
    for (const dispatch of dispatches) {
      await this.creator.deliver(`${event.id}:${dispatch.type}`, dispatch);
    }
    for (const fanout of fanouts) {
      const job: FanoutJob = {
        source: `${event.id}:${fanout.type}`,
        fanout,
        afterFollowerId: null,
      };
      await this.queue.add(NOTIFICATIONS_JOBS.fanout, job, {
        jobId: `${NOTIFICATIONS_JOBS.fanout}-${event.id}-${fanout.type}-start`,
      });
    }
    if (event.type === MessageSent.TYPE) {
      const p = event.payload;
      const recipients = Array.isArray(p['recipientIds'])
        ? p['recipientIds'].filter((id): id is string => typeof id === 'string')
        : [];
      if (typeof p['conversationId'] === 'string' && typeof p['sequence'] === 'number') {
        await this.emails.scheduleUnreadCopies(p['conversationId'], p['sequence'], recipients);
      }
    }
  }
}

/** Delivers a created or grown notification on every channel: push, counters, email. */
@Injectable()
@DomainEventHandler({ name: 'notifications.deliver', eventTypes: [NotificationCreated.TYPE] })
export class NotificationDeliveryHandler implements DomainEventSubscriber {
  constructor(
    private readonly notifications: NotificationsRepository,
    @Inject(NOTIFICATION_CHANNEL_ADAPTERS)
    private readonly channels: readonly NotificationChannelAdapter[],
  ) {}

  async handle(event: OutboxEnvelope): Promise<void> {
    const notification = await this.notifications.findNotification(event.aggregateId);
    if (!notification) return;
    const created = event.payload['created'] === true;
    for (const channel of this.channels) await channel.deliver(notification, created);
  }
}
