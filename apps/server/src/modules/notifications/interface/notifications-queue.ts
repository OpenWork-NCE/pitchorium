/** BullMQ queue of the notifications module (worker): fan-outs, emails and scheduled tasks. */
export const NOTIFICATIONS_QUEUE = 'notifications.delivery';

export const NOTIFICATIONS_JOBS = {
  fanout: 'fanout',
  unreadMessageEmails: 'unread-message-emails',
  digests: 'digests',
  profileViews: 'profile-views',
  purge: 'purge',
} as const;
