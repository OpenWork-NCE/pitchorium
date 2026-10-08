/** BullMQ queue of the privacy module (worker). */
export const PRIVACY_QUEUE = 'privacy.requests';

export const PRIVACY_JOBS = {
  buildExport: 'build-export',
  /** Erasures due, blocked or interrupted (every 15 minutes). */
  executeErasures: 'execute-erasures',
  /** Reminders before an erasure (daily). */
  remindErasures: 'remind-erasures',
  /** Archives past their expiry (hourly). */
  expireExports: 'expire-exports',
} as const;
