import type { NotificationTargetType, NotificationType } from '@pitchorium/contracts';
import type { Grouping } from './notification-types';

/** Actors kept on a notification, the most recent first; `actor_count` counts them all. */
export const MAX_ACTORS = 5;

/** Key of the notification an event joins while its window is open (ADR 0059). */
export function groupKeyOf(
  type: NotificationType,
  grouping: Grouping,
  target: { type: NotificationTargetType; key: string },
  source: string,
): string {
  switch (grouping) {
    case 'target':
      return `${type}:${target.type}:${target.key}`;
    case 'type':
      return type;
    case 'none':
      return `${type}:${source}`;
  }
}

/**
 * Adds an event to a notification: its actor goes first; a new actor counts once, an actor
 * already there only moves up.
 */
export function mergeActor(
  actorIds: readonly string[],
  actorCount: number,
  actorId: string | null,
): { actorIds: string[]; actorCount: number } {
  if (!actorId) return { actorIds: [...actorIds], actorCount };
  const known = actorIds.includes(actorId);
  return {
    actorIds: [actorId, ...actorIds.filter((id) => id !== actorId)].slice(0, MAX_ACTORS),
    actorCount: known ? actorCount : actorCount + 1,
  };
}

/** The window of a notification opens with its first event and does not slide. */
export function windowEnd(createdAt: Date, windowMs: number): Date {
  return new Date(createdAt.getTime() + windowMs);
}
