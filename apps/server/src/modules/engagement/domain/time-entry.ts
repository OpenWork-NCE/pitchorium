import type { TimeEntryKind, TimeEntryStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface TimeEntryRecord {
  id: string;
  contributorId: string;
  /** Exactly one of project and entrepreneur. */
  projectId: string | null;
  entrepreneurId: string | null;
  kind: TimeEntryKind;
  minutes: number;
  /** YYYY-MM-DD. */
  date: string;
  description: string;
  status: TimeEntryStatus;
  respondedAt: Date | null;
  respondedBy: string | null;
  disputeReason: string | null;
  createdAt: Date;
}

/** Declared time is answered once, by the beneficiary: confirmed or disputed. */
export function assertAnswerable(entry: TimeEntryRecord): void {
  if (entry.status !== 'declared') {
    throw new DomainError(
      'ENGAGEMENT_TIME_ENTRY_ALREADY_ANSWERED',
      'The time entry was already answered',
    );
  }
}

/** Time is shared on a day that already happened (UTC), not in the future. */
export function assertPastDate(date: string, now: Date): void {
  if (date > now.toISOString().slice(0, 10)) {
    throw new DomainError('VALIDATION_FAILED', 'A time entry is dated today or before');
  }
}

/** First instant of the current month, UTC. */
export function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
