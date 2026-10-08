import { Inject, Injectable } from '@nestjs/common';
import type {
  NotificationChannel,
  NotificationTargetType,
  NotificationType,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import { NetworkFacade } from '../../network';
import { groupKeyOf, MAX_ACTORS, windowEnd } from '../domain/aggregation';
import { NOTIFICATION_DEFINITIONS } from '../domain/notification-types';
import { NotificationBatchCreated } from '../domain/notifications-events';
import { resolveChannels } from '../domain/preferences';
import { type NotificationData, type NotificationRecord, NotificationsRepository } from './ports';

const DAY_MS = 86_400_000;

/** One event to notify to some members (ADR 0059). */
export interface Dispatch {
  type: NotificationType;
  recipientIds: readonly string[];
  actorId: string | null;
  target: { type: NotificationTargetType; key: string };
  data?: NotificationData;
  /** Actors to add beyond the main one (scheduled sources: the visitors of a profile). */
  extraActors?: { ids: readonly string[]; count: number };
}

/**
 * Creates the notifications of one source event, for any number of recipients at once:
 * idempotent per (source, recipient), grouped in the open notification of the same key,
 * capped per member for low priority, with the channels each member chose. The created and
 * grown notifications record one `notifications.batch.created.v1`, delivered by one job (push
 * and immediate emails, ADR 0064). Joins the caller's transaction.
 */
@Injectable()
export class NotificationCreator {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly network: NetworkFacade,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async deliver(source: string, dispatch: Dispatch): Promise<number> {
    const blocked = dispatch.actorId
      ? new Set(await this.network.blockedUserIds(dispatch.actorId))
      : new Set<string>();
    const recipients = [...new Set(dispatch.recipientIds)].filter(
      (id) => id !== dispatch.actorId && !blocked.has(id),
    );
    if (recipients.length === 0) return 0;
    const definition = NOTIFICATION_DEFINITIONS[dispatch.type];
    const groupKey = groupKeyOf(dispatch.type, definition.grouping, dispatch.target, source);

    return this.transactions.run(async () => {
      // Concurrent events of one group wait for each other: they join one notification.
      await this.notifications.lock(`notifications:${groupKey}`);
      const now = this.clock.now();
      const fresh = await this.notifications.insertDeliveries(source, recipients, now);
      if (fresh.length === 0) return 0;
      const open = await this.notifications.openNotifications(fresh, groupKey, now);
      const grown = [...open.values()];
      if (grown.length > 0) {
        await this.notifications.aggregate(
          grown.map((notification) => notification.id),
          dispatch.actorId,
          MAX_ACTORS,
          now,
        );
      }
      let created = fresh.filter((id) => !open.has(id));
      if (definition.priority === 'low' && created.length > 0) {
        const counts = await this.notifications.countLowPrioritySince(
          created,
          new Date(now.getTime() - DAY_MS),
        );
        created = created.filter(
          (id) => (counts.get(id) ?? 0) < this.config.notifications.lowPriorityPerDay,
        );
      }
      const records = await this.records(created, dispatch, groupKey, now);
      await this.notifications.insertNotifications(records);
      if (grown.length + records.length > 0) {
        await this.outbox.record(
          new NotificationBatchCreated({
            id: this.ids.next(),
            aggregateId: this.ids.next(),
            occurredAt: now,
            payload: {
              type: dispatch.type,
              created: records.map((record) => record.id),
              grown: grown.map((notification) => notification.id),
            },
          }),
        );
      }
      return grown.length + records.length;
    });
  }

  private async records(
    recipientIds: readonly string[],
    dispatch: Dispatch,
    groupKey: string,
    now: Date,
  ): Promise<NotificationRecord[]> {
    if (recipientIds.length === 0) return [];
    const definition = NOTIFICATION_DEFINITIONS[dispatch.type];
    const [preferences, digests] = await Promise.all([
      this.notifications.preferencesOf(recipientIds, dispatch.type),
      this.notifications.digestsOf(recipientIds),
    ]);
    const extra = dispatch.extraActors;
    const actorIds = [
      ...(dispatch.actorId ? [dispatch.actorId] : []),
      ...(extra?.ids ?? []).filter((id) => id !== dispatch.actorId),
    ].slice(0, MAX_ACTORS);
    const actorCount = extra ? Math.max(extra.count, actorIds.length) : actorIds.length;
    return recipientIds.flatMap((recipientId) => {
      const chosen = new Map<NotificationChannel, boolean>(
        preferences
          .filter((preference) => preference.userId === recipientId)
          .map((preference) => [preference.channel, preference.enabled]),
      );
      const channels = resolveChannels(dispatch.type, chosen, digests.get(recipientId) ?? 'off');
      // Nothing to deliver on any channel: no notification at all.
      if (!channels.inApp && channels.email === 'off') return [];
      return [
        {
          id: this.ids.next(),
          recipientId,
          type: dispatch.type,
          groupKey,
          priority: definition.priority,
          actorIds,
          actorCount,
          eventCount: 1,
          targetType: dispatch.target.type,
          targetId: dispatch.target.key,
          data: dispatch.data ?? {},
          windowEndsAt: windowEnd(now, this.config.notifications.aggregationWindowMs),
          readAt: null,
          inApp: channels.inApp,
          emailMode: channels.email,
          emailedAt: null,
          digestPending: channels.email === 'digest',
          createdAt: now,
          updatedAt: now,
        },
      ];
    });
  }
}
