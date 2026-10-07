import type { EmailDigest, NotificationChannel, NotificationType } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { NOTIFICATION_DEFINITIONS } from './notification-types';

/** How the email channel delivers a notification. */
export type EmailMode = 'off' | 'immediate' | 'digest';

export interface ResolvedChannels {
  inApp: boolean;
  email: EmailMode;
}

/**
 * Channels of a notification for a member (ADR 0060): their choice per type and channel, or the
 * default of the type; transactional types always use their defaults, sent at once. A chosen
 * digest gathers the other emails; a low-priority type is never emailed at once.
 */
export function resolveChannels(
  type: NotificationType,
  chosen: ReadonlyMap<NotificationChannel, boolean>,
  digest: EmailDigest,
): ResolvedChannels {
  const definition = NOTIFICATION_DEFINITIONS[type];
  if (definition.transactional) {
    return {
      inApp: definition.defaults.in_app,
      email: definition.defaults.email ? 'immediate' : 'off',
    };
  }
  const inApp = chosen.get('in_app') ?? definition.defaults.in_app;
  const emailOn = chosen.get('email') ?? definition.defaults.email;
  if (!emailOn || definition.emailAsUnreadCopy) return { inApp, email: 'off' };
  if (digest !== 'off') return { inApp, email: 'digest' };
  return { inApp, email: definition.priority === 'low' ? 'off' : 'immediate' };
}

/** A transactional type cannot be turned off, on any channel. */
export function assertEditable(type: NotificationType): void {
  if (NOTIFICATION_DEFINITIONS[type].transactional) {
    throw new DomainError(
      'NOTIFICATIONS_PREFERENCE_LOCKED',
      `${type} is transactional and cannot be changed`,
    );
  }
}

/** The copy of unread messages by email (§10.4): only when the member turned it on. */
export function wantsUnreadCopy(chosen: ReadonlyMap<NotificationChannel, boolean>): boolean {
  return chosen.get('email') ?? NOTIFICATION_DEFINITIONS.message.defaults.email;
}
