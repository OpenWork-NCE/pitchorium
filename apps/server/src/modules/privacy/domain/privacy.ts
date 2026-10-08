import type { ErasureStatus, ExportStatus, Locale } from '@pitchorium/contracts';

export interface ExportRecord {
  id: string;
  userId: string | null;
  status: ExportStatus;
  storageKey: string | null;
  sizeBytes: number | null;
  error: string | null;
  requestedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
}

export interface ErasureRecord {
  id: string;
  userId: string | null;
  status: ErasureStatus;
  pseudonym: string | null;
  contact: { email: string; name: string | null; locale: Locale } | null;
  progress: string[];
  blockedBy: string | null;
  residues: string[] | null;
  requestedAt: Date;
  scheduledFor: Date;
  remindedAt: Date | null;
  canceledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

const DAY_MS = 86_400_000;
/** Answer to a rights request: one month (article 12(3)), counted here as 30 days. */
export const LEGAL_ANSWER_DAYS = 30;

/** A new export only once the previous one is older than the interval, unless it failed. */
export function exportAllowed(
  latest: ExportRecord | null,
  now: Date,
  minIntervalMs: number,
): boolean {
  if (!latest || latest.status === 'failed') return true;
  return now.getTime() - latest.requestedAt.getTime() >= minIntervalMs;
}

export function erasureDate(requestedAt: Date, graceDays: number): Date {
  return new Date(requestedAt.getTime() + graceDays * DAY_MS);
}

/** The reminder goes once, `reminderDays` before the erasure. */
export function reminderDue(erasure: ErasureRecord, now: Date, reminderDays: number): boolean {
  return (
    erasure.status === 'scheduled' &&
    erasure.remindedAt === null &&
    erasure.scheduledFor.getTime() - reminderDays * DAY_MS <= now.getTime()
  );
}

/**
 * Scheduled and due, blocked and checked again (the campaign may have closed), or interrupted
 * while running (resumed).
 */
export function erasureDue(erasure: ErasureRecord, now: Date): boolean {
  return (
    ((erasure.status === 'scheduled' || erasure.status === 'blocked') &&
      erasure.scheduledFor <= now) ||
    erasure.status === 'running'
  );
}

export function cancelable(erasure: ErasureRecord): boolean {
  return erasure.status === 'scheduled' || erasure.status === 'blocked';
}

export function answerDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + LEGAL_ANSWER_DAYS * DAY_MS);
}
