import type {
  MissionDirection,
  MissionEngagementStatus,
  MissionMode,
  MissionModerationStatus,
  TimeEntryKind,
} from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { EngagementRecord, MissionRecord } from '../domain/mission';

export interface MissionListFilter {
  direction?: MissionDirection | undefined;
  kind?: TimeEntryKind | undefined;
  mode?: MissionMode | undefined;
  sectorCode?: string | undefined;
  countryCode?: string | undefined;
  language?: string | undefined;
  /** Missions whose visibility is `public` (the author's public page is checked by the caller). */
  publicOnly: boolean;
  /** Authors hidden from the reader (blocks). */
  hiddenAuthorIds: readonly string[];
}

export abstract class MissionsRepository {
  abstract insertMission(mission: MissionRecord): Promise<void>;
  abstract findMission(id: string): Promise<MissionRecord | null>;
  abstract findMissions(ids: readonly string[]): Promise<MissionRecord[]>;
  abstract lockMission(id: string): Promise<MissionRecord | null>;
  abstract updateMission(id: string, patch: Partial<MissionRecord>): Promise<void>;
  /** Open and visible missions, newest first. */
  abstract listOpen(
    filter: MissionListFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<MissionRecord[]>;
  abstract authoredBy(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<MissionRecord[]>;
  /** Every mission, by ascending id (search index rebuild). */
  abstract idsAfter(after: string | null, limit: number): Promise<string[]>;
  abstract setModerationStatus(
    id: string,
    status: MissionModerationStatus,
    at: Date,
  ): Promise<void>;

  abstract insertEngagement(engagement: EngagementRecord): Promise<void>;
  abstract findEngagement(id: string): Promise<EngagementRecord | null>;
  abstract findEngagements(ids: readonly string[]): Promise<EngagementRecord[]>;
  abstract lockEngagement(id: string): Promise<EngagementRecord | null>;
  abstract updateEngagement(id: string, patch: Partial<EngagementRecord>): Promise<void>;
  /** Asked or in progress, between this expert and this beneficiary on the mission. */
  abstract openEngagement(
    missionId: string,
    expertId: string,
    beneficiaryId: string,
  ): Promise<EngagementRecord | null>;
  /** The reader's own open or finished engagement on each mission, the latest. */
  abstract engagementsOfMember(
    userId: string,
    missionIds: readonly string[],
  ): Promise<Map<string, EngagementRecord>>;
  abstract engagementsOfMission(
    missionId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EngagementRecord[]>;
  abstract engagementsOf(
    userId: string,
    filter: {
      role?: 'expert' | 'beneficiary' | undefined;
      status?: MissionEngagementStatus | undefined;
    },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EngagementRecord[]>;
}
