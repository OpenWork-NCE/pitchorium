import { Injectable } from '@nestjs/common';
import type {
  MissionDirection,
  MissionEngagementStatus,
  MissionFormat,
  MissionMode,
  MissionModerationStatus,
  MissionStatus,
  MissionVisibility,
  TimeEntryKind,
} from '@pitchorium/contracts';
import { and, asc, desc, eq, gt, inArray, notInArray, or, sql } from '@pitchorium/db/orm';
import { missionsEngagements, missionsMissions } from '@pitchorium/db/schemas/missions';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import { type MissionListFilter, MissionsRepository } from '../application/ports';
import type { EngagementRecord, MissionRecord } from '../domain/mission';

type MissionRow = typeof missionsMissions.$inferSelect;
type EngagementRow = typeof missionsEngagements.$inferSelect;

const toMission = (row: MissionRow): MissionRecord => ({
  ...row,
  direction: row.direction as MissionDirection,
  kind: row.kind as TimeEntryKind,
  format: row.format as MissionFormat,
  mode: row.mode as MissionMode,
  visibility: row.visibility as MissionVisibility,
  status: row.status as MissionStatus,
  moderationStatus: row.moderationStatus as MissionModerationStatus,
});

const toEngagement = (row: EngagementRow): EngagementRecord => ({
  ...row,
  status: row.status as MissionEngagementStatus,
});

const OPEN = ['requested', 'accepted'];

@Injectable()
export class DrizzleMissionsRepository extends MissionsRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async insertMission(mission: MissionRecord): Promise<void> {
    await this.db.insert(missionsMissions).values(mission);
  }

  async findMission(id: string): Promise<MissionRecord | null> {
    const [row] = await this.db.select().from(missionsMissions).where(eq(missionsMissions.id, id));
    return row ? toMission(row) : null;
  }

  async findMissions(ids: readonly string[]): Promise<MissionRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(missionsMissions)
      .where(inArray(missionsMissions.id, [...ids]));
    const byId = new Map(rows.map((row) => [row.id, toMission(row)]));
    return ids.flatMap((id) => {
      const mission = byId.get(id);
      return mission ? [mission] : [];
    });
  }

  async lockMission(id: string): Promise<MissionRecord | null> {
    const [row] = await this.db
      .select()
      .from(missionsMissions)
      .where(eq(missionsMissions.id, id))
      .for('update');
    return row ? toMission(row) : null;
  }

  async updateMission(id: string, patch: Partial<MissionRecord>): Promise<void> {
    await this.db.update(missionsMissions).set(patch).where(eq(missionsMissions.id, id));
  }

  async listOpen(
    filter: MissionListFilter,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<MissionRecord[]> {
    const rows = await this.db
      .select()
      .from(missionsMissions)
      .where(
        and(
          eq(missionsMissions.status, 'open'),
          eq(missionsMissions.moderationStatus, 'visible'),
          filter.direction ? eq(missionsMissions.direction, filter.direction) : undefined,
          filter.kind ? eq(missionsMissions.kind, filter.kind) : undefined,
          filter.mode ? eq(missionsMissions.mode, filter.mode) : undefined,
          filter.sectorCode
            ? sql`${filter.sectorCode} = any(${missionsMissions.sectorCodes})`
            : undefined,
          filter.countryCode
            ? sql`${filter.countryCode} = any(${missionsMissions.countryCodes})`
            : undefined,
          filter.language
            ? sql`${filter.language} = any(${missionsMissions.languages})`
            : undefined,
          filter.publicOnly ? eq(missionsMissions.visibility, 'public') : undefined,
          filter.hiddenAuthorIds.length > 0
            ? notInArray(missionsMissions.authorId, [...filter.hiddenAuthorIds])
            : undefined,
          after
            ? sql`(${missionsMissions.publishedAt}, ${missionsMissions.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(missionsMissions.publishedAt), desc(missionsMissions.id))
      .limit(limit);
    return rows.map(toMission);
  }

  async authoredBy(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<MissionRecord[]> {
    const rows = await this.db
      .select()
      .from(missionsMissions)
      .where(
        and(
          eq(missionsMissions.authorId, userId),
          after
            ? sql`(${missionsMissions.publishedAt}, ${missionsMissions.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(missionsMissions.publishedAt), desc(missionsMissions.id))
      .limit(limit);
    return rows.map(toMission);
  }

  async idsAfter(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: missionsMissions.id })
      .from(missionsMissions)
      .where(after ? gt(missionsMissions.id, after) : undefined)
      .orderBy(asc(missionsMissions.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async setModerationStatus(id: string, status: MissionModerationStatus, at: Date): Promise<void> {
    await this.db
      .update(missionsMissions)
      .set({ moderationStatus: status, updatedAt: at })
      .where(eq(missionsMissions.id, id));
  }

  async insertEngagement(engagement: EngagementRecord): Promise<void> {
    await this.db.insert(missionsEngagements).values(engagement);
  }

  async findEngagement(id: string): Promise<EngagementRecord | null> {
    const [row] = await this.db
      .select()
      .from(missionsEngagements)
      .where(eq(missionsEngagements.id, id));
    return row ? toEngagement(row) : null;
  }

  async findEngagements(ids: readonly string[]): Promise<EngagementRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(missionsEngagements)
      .where(inArray(missionsEngagements.id, [...ids]));
    return rows.map(toEngagement);
  }

  async lockEngagement(id: string): Promise<EngagementRecord | null> {
    const [row] = await this.db
      .select()
      .from(missionsEngagements)
      .where(eq(missionsEngagements.id, id))
      .for('update');
    return row ? toEngagement(row) : null;
  }

  async updateEngagement(id: string, patch: Partial<EngagementRecord>): Promise<void> {
    await this.db.update(missionsEngagements).set(patch).where(eq(missionsEngagements.id, id));
  }

  async openEngagement(
    missionId: string,
    expertId: string,
    beneficiaryId: string,
  ): Promise<EngagementRecord | null> {
    const [row] = await this.db
      .select()
      .from(missionsEngagements)
      .where(
        and(
          eq(missionsEngagements.missionId, missionId),
          eq(missionsEngagements.expertId, expertId),
          eq(missionsEngagements.beneficiaryId, beneficiaryId),
          inArray(missionsEngagements.status, OPEN),
        ),
      );
    return row ? toEngagement(row) : null;
  }

  async engagementsOfMember(
    userId: string,
    missionIds: readonly string[],
  ): Promise<Map<string, EngagementRecord>> {
    if (missionIds.length === 0) return new Map();
    const rows = await this.db
      .select()
      .from(missionsEngagements)
      .where(
        and(
          inArray(missionsEngagements.missionId, [...missionIds]),
          or(
            eq(missionsEngagements.expertId, userId),
            eq(missionsEngagements.beneficiaryId, userId),
          ),
        ),
      )
      .orderBy(asc(missionsEngagements.requestedAt));
    // The latest engagement of the member on each mission.
    return new Map(rows.map((row) => [row.missionId, toEngagement(row)]));
  }

  async engagementsOfMission(
    missionId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EngagementRecord[]> {
    const rows = await this.db
      .select()
      .from(missionsEngagements)
      .where(
        and(
          eq(missionsEngagements.missionId, missionId),
          after
            ? sql`(${missionsEngagements.requestedAt}, ${missionsEngagements.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(missionsEngagements.requestedAt), desc(missionsEngagements.id))
      .limit(limit);
    return rows.map(toEngagement);
  }

  async engagementsOf(
    userId: string,
    filter: {
      role?: 'expert' | 'beneficiary' | undefined;
      status?: MissionEngagementStatus | undefined;
    },
    after: KeysetPosition | null,
    limit: number,
  ): Promise<EngagementRecord[]> {
    const rows = await this.db
      .select()
      .from(missionsEngagements)
      .where(
        and(
          filter.role === 'expert'
            ? eq(missionsEngagements.expertId, userId)
            : filter.role === 'beneficiary'
              ? eq(missionsEngagements.beneficiaryId, userId)
              : or(
                  eq(missionsEngagements.expertId, userId),
                  eq(missionsEngagements.beneficiaryId, userId),
                ),
          filter.status ? eq(missionsEngagements.status, filter.status) : undefined,
          after
            ? sql`(${missionsEngagements.requestedAt}, ${missionsEngagements.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(missionsEngagements.requestedAt), desc(missionsEngagements.id))
      .limit(limit);
    return rows.map(toEngagement);
  }
}
