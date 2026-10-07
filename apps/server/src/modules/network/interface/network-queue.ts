/** BullMQ queue of the network module (worker): scheduled tasks. */
export const NETWORK_QUEUE = 'network.maintenance';

export const NETWORK_JOBS = {
  expireRequests: 'expire-connection-requests',
  flushProfileViews: 'flush-profile-views',
  purgeProfileViews: 'purge-profile-views',
} as const;
