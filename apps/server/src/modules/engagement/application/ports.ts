import type { TimeEntryStatus } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { ContributionFacts } from '../../payments';
import type { TimeEntryRecord } from '../domain/time-entry';

export interface ContributionTotals {
  givenEurMinor: bigint;
  givenThisMonthEurMinor: bigint;
  projectsSupported: number;
}

export type GiverRef = { type: 'member'; id: string } | { type: 'organization'; id: string };

export abstract class EngagementRepository {
  abstract upsertFacts(facts: ContributionFacts, now: Date): Promise<void>;
  abstract deleteAllFacts(): Promise<void>;
  abstract totals(giver: GiverRef, monthStart: Date): Promise<ContributionTotals>;
  /** Contributions that count for the giver, newest first. */
  abstract factsOf(giver: GiverRef): Promise<
    {
      contributionId: string;
      projectId: string;
      status: string;
      netEurMinor: bigint;
      succeededAt: Date | null;
    }[]
  >;

  abstract insertTimeEntry(entry: TimeEntryRecord): Promise<void>;
  abstract findTimeEntry(id: string): Promise<TimeEntryRecord | null>;
  abstract lockTimeEntry(id: string): Promise<TimeEntryRecord | null>;
  abstract updateTimeEntry(id: string, patch: Partial<TimeEntryRecord>): Promise<void>;
  abstract timeEntries(
    filter: {
      contributorId?: string;
      entrepreneurId?: string;
      projectIds?: readonly string[];
      status?: TimeEntryStatus;
    },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<TimeEntryRecord[]>;
  abstract minutesByStatus(contributorId: string): Promise<Record<TimeEntryStatus, number>>;
}
