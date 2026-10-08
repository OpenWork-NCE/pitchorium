import type { SuspensionRecord } from './trust';

/** Started, not lifted, and not over (a permanent suspension has no end). */
export function isActive(suspension: SuspensionRecord, now: Date): boolean {
  return (
    suspension.liftedAt === null &&
    suspension.startsAt <= now &&
    (suspension.endsAt === null || suspension.endsAt > now)
  );
}

/** Over by its end or lifted, and not yet announced by `trust.suspension.ended.v1`. */
export function isOverAndUnannounced(suspension: SuspensionRecord, now: Date): boolean {
  return suspension.endedAt === null && !isActive(suspension, now);
}
