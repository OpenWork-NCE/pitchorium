import type { RepeatOptions } from 'bullmq';

/**
 * Repeat options of a scheduled task: its cron pattern, or a fixed interval when
 * SCHEDULED_TASKS_EVERY_MS is set (tests and local debugging, refused in production).
 */
export function repeatEvery(
  pattern: string,
  everyMsOverride: number | undefined,
): Omit<RepeatOptions, 'key'> {
  return everyMsOverride === undefined ? { pattern } : { every: everyMsOverride };
}
