import { Injectable } from '@nestjs/common';
import type { Notification } from '@pitchorium/contracts';
import { ProfilesFacade } from '../../profiles';
import { pathOf } from '../domain/notification-types';
import type { NotificationRecord } from './ports';

/** Actors shown on a notification, the most recent first. */
const SHOWN_ACTORS = 3;

/** Notifications as their recipient sees them: actors hidden across a block are left out. */
@Injectable()
export class NotificationPresenter {
  constructor(private readonly profiles: ProfilesFacade) {}

  async present(viewerId: string, records: readonly NotificationRecord[]): Promise<Notification[]> {
    const cards = await this.profiles.memberCards(
      [...new Set(records.flatMap((record) => record.actorIds))],
      viewerId,
    );
    return records.map((record) => ({
      id: record.id,
      type: record.type,
      priority: record.priority,
      actors: record.actorIds
        .flatMap((id) => {
          const card = cards.get(id);
          return card
            ? [
                {
                  handle: card.handle,
                  displayName: card.displayName,
                  headline: card.headline,
                  avatarUrl: card.avatarUrl,
                },
              ]
            : [];
        })
        .slice(0, SHOWN_ACTORS),
      actorCount: record.actorCount,
      eventCount: record.eventCount,
      target: {
        type: record.targetType,
        key: record.targetId,
        path: pathOf(record.targetType, record.targetId),
      },
      data: record.data,
      read: record.readAt !== null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }));
  }
}
