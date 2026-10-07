import type { DefaultJobOptions } from 'bullmq';

const HOUR_IN_SECONDS = 3600;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 1000 },
  // Completed jobs are kept one day: the outbox relay relies on job ids to ignore duplicates.
  removeOnComplete: { age: 24 * HOUR_IN_SECONDS, count: 50_000 },
  removeOnFail: { age: 7 * 24 * HOUR_IN_SECONDS },
};
