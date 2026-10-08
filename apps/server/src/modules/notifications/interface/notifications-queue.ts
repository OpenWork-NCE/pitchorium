/**
 * BullMQ queue of the notifications module (worker): fan-outs, delivery of the batches (push
 * and emails), emails and scheduled tasks.
 */
export const NOTIFICATIONS_QUEUE = 'notifications.delivery';

export const NOTIFICATIONS_JOBS = {
  fanout: 'fanout',
  deliver: 'deliver',
  unreadMessageEmails: 'unread-message-emails',
  digests: 'digests',
  profileViews: 'profile-views',
  purge: 'purge',
} as const;
