import { Injectable } from '@nestjs/common';
import type { TimeEntryKind, TimeEntryStatus } from '@pitchorium/contracts';
import { EngagementService, type TimeBeneficiary } from './engagement.service';

export interface DeclaredTime {
  id: string;
  minutes: number;
  status: TimeEntryStatus;
}

/**
 * Public facade of the engagement module: the missions module declares the time of a completed
 * mission in the shared time log, once, then reads its answer (no double entry).
 */
@Injectable()
export class EngagementFacade {
  constructor(private readonly engagement: EngagementService) {}

  /** Joins the caller's transaction; the beneficiary confirms or disputes it as any entry. */
  async declareTime(declaration: {
    contributorId: string;
    beneficiary: TimeBeneficiary;
    kind: TimeEntryKind;
    minutes: number;
    date: string;
    description: string;
    missionEngagementId: string;
  }): Promise<DeclaredTime> {
    const entry = await this.engagement.declareFor(
      declaration.contributorId,
      declaration.beneficiary,
      declaration,
      declaration.missionEngagementId,
    );
    return { id: entry.id, minutes: entry.minutes, status: entry.status };
  }

  async timeEntries(ids: readonly string[]): Promise<Map<string, DeclaredTime>> {
    const entries = await this.engagement.entries(ids);
    return new Map(
      [...entries].map(([id, entry]) => [
        id,
        { id: entry.id, minutes: entry.minutes, status: entry.status },
      ]),
    );
  }
}
