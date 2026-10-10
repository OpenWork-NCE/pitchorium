import { Injectable } from '@nestjs/common';
import type {
  FundingInstrument,
  ImpactLevel,
  ProjectInterestKind,
  ProjectModerationStatus,
  ProjectStatus,
  ProjectTeamRole,
  RewardInstrument,
  VideoProvider,
} from '@pitchorium/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
} from '@pitchorium/db/orm';
import {
  projectsFundingEntries,
  projectsFundingReversals,
  projectsInterests,
  projectsProjects,
  projectsRewardReservations,
  projectsRewards,
  projectsSlugHistory,
  projectsTeamMembers,
  projectsTiers,
  projectsUpdates,
} from '@pitchorium/db/schemas/projects';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import {
  type FundingEntryRecord,
  type FundingReversalRecord,
  type ProjectPatch,
  ProjectRepository,
  type RewardPatch,
  type ShowcaseFilter,
  type ShowcasePosition,
  type TeamMemberPatch,
  type UpdatePatch,
} from '../application/ports';
import type { InterestRecord, UpdateRecord } from '../domain/activity';
import type { TierRecord } from '../domain/funding';
import type { ProjectRecord, TeamMemberRecord } from '../domain/project';
import type { ReservationRecord, ReservationStatus, RewardRecord } from '../domain/rewards';

type ProjectRow = typeof projectsProjects.$inferSelect;
type ProjectInsert = typeof projectsProjects.$inferInsert;

const toProject = (row: ProjectRow): ProjectRecord => {
  const { videoProvider, videoId, videoHash, ...rest } = row;
  return {
    ...rest,
    video:
      videoProvider && videoId
        ? { provider: videoProvider as VideoProvider, videoId, hash: videoHash }
        : null,
    instruments: row.instruments as FundingInstrument[],
    status: row.status as ProjectStatus,
    impactLevel: row.impactLevel as ImpactLevel | null,
    moderationStatus: row.moderationStatus as ProjectModerationStatus,
  };
};

/** Columns of a record or a patch; `video` is spread over its three columns. */
function toColumns(patch: ProjectPatch): Partial<ProjectInsert> {
  const { video, ...rest } = patch;
  if (video === undefined) return rest;
  return {
    ...rest,
    videoProvider: video?.provider ?? null,
    videoId: video?.videoId ?? null,
    videoHash: video?.hash ?? null,
  };
}

const toMember = (row: typeof projectsTeamMembers.$inferSelect): TeamMemberRecord => ({
  ...row,
  role: row.role as ProjectTeamRole,
  status: row.status as TeamMemberRecord['status'],
});

const toReward = (row: typeof projectsRewards.$inferSelect): RewardRecord => ({
  ...row,
  instruments: row.instruments as RewardInstrument[],
});

const toUpdate = (row: typeof projectsUpdates.$inferSelect): UpdateRecord => ({
  ...row,
  moderationStatus: row.moderationStatus as ProjectModerationStatus,
});

const toInterest = (row: typeof projectsInterests.$inferSelect): InterestRecord => ({
  ...row,
  kind: row.kind as ProjectInterestKind,
});

/** Published, live and visible: what the showcase and the followers may see. */
const showable = and(
  ne(projectsProjects.status, 'draft'),
  isNull(projectsProjects.deletedAt),
  eq(projectsProjects.moderationStatus, 'visible'),
);

@Injectable()
export class DrizzleProjectsRepository extends ProjectRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertProject(project: ProjectRecord): Promise<boolean> {
    // No conflict target: a taken slug is reported instead of aborting the transaction.
    const inserted = await this.db
      .insert(projectsProjects)
      .values({ ...(toColumns(project) as ProjectInsert), id: project.id, slug: project.slug })
      .onConflictDoNothing()
      .returning({ id: projectsProjects.id });
    return inserted.length > 0;
  }

  async findProject(id: string): Promise<ProjectRecord | null> {
    const [row] = await this.db.select().from(projectsProjects).where(eq(projectsProjects.id, id));
    return row ? toProject(row) : null;
  }

  async idsAfter(after: string | null, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: projectsProjects.id })
      .from(projectsProjects)
      .where(
        and(isNull(projectsProjects.deletedAt), after ? gt(projectsProjects.id, after) : undefined),
      )
      .orderBy(asc(projectsProjects.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ status: projectsProjects.status, total: count() })
      .from(projectsProjects)
      .where(isNull(projectsProjects.deletedAt))
      .groupBy(projectsProjects.status);
    return Object.fromEntries(rows.map((row) => [row.status, row.total]));
  }

  async featuredProjects(limit: number): Promise<{ id: string; featuredAt: Date | null }[]> {
    return this.db
      .select({ id: projectsProjects.id, featuredAt: projectsProjects.featuredAt })
      .from(projectsProjects)
      .where(and(isNotNull(projectsProjects.featuredAt), isNull(projectsProjects.deletedAt)))
      .orderBy(desc(projectsProjects.featuredAt))
      .limit(limit);
  }

  async findProjects(ids: readonly string[]): Promise<ProjectRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(projectsProjects)
      .where(inArray(projectsProjects.id, [...ids]));
    return rows.map(toProject);
  }

  async lockProject(id: string): Promise<ProjectRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsProjects)
      .where(eq(projectsProjects.id, id))
      .for('update');
    return row ? toProject(row) : null;
  }

  async updateProject(id: string, patch: ProjectPatch, now: Date): Promise<void> {
    await this.db
      .update(projectsProjects)
      .set({ ...toColumns(patch), updatedAt: now })
      .where(eq(projectsProjects.id, id));
  }

  async resolveSlug(slug: string): Promise<{ projectId: string; current: boolean } | null> {
    const [current] = await this.db
      .select({ id: projectsProjects.id })
      .from(projectsProjects)
      .where(eq(projectsProjects.slug, slug));
    if (current) return { projectId: current.id, current: true };
    const [former] = await this.db
      .select({ projectId: projectsSlugHistory.projectId })
      .from(projectsSlugHistory)
      .where(eq(projectsSlugHistory.slug, slug));
    return former ? { projectId: former.projectId, current: false } : null;
  }

  async isSlugUnavailable(slug: string, forProjectId: string | null): Promise<boolean> {
    // A former slug stays with its project: only that project may take it back.
    const resolved = await this.resolveSlug(slug);
    return resolved !== null && resolved.projectId !== forProjectId;
  }

  async changeSlug(id: string, previous: string, next: string, now: Date): Promise<void> {
    // A former slug of the same project may come back: it leaves the history.
    await this.db
      .delete(projectsSlugHistory)
      .where(and(eq(projectsSlugHistory.slug, next), eq(projectsSlugHistory.projectId, id)));
    await this.db
      .insert(projectsSlugHistory)
      .values({ slug: previous, projectId: id, replacedAt: now })
      .onConflictDoNothing();
    await this.db
      .update(projectsProjects)
      .set({ slug: next, updatedAt: now })
      .where(eq(projectsProjects.id, id));
  }

  async showcase(
    filter: ShowcaseFilter,
    after: ShowcasePosition | null,
    limit: number,
  ): Promise<ProjectRecord[]> {
    const conditions: (SQL | undefined)[] = [showable];
    if (filter.countryCode) {
      conditions.push(sql`${filter.countryCode} = any(${projectsProjects.countryCodes})`);
    }
    if (filter.sectorCode) conditions.push(eq(projectsProjects.sectorCode, filter.sectorCode));
    if (filter.status) conditions.push(eq(projectsProjects.status, filter.status));
    if (filter.minImpact !== undefined) {
      conditions.push(gte(projectsProjects.impactScore, filter.minImpact));
    }
    if (filter.featured === true) conditions.push(sql`${projectsProjects.featuredAt} is not null`);
    if (filter.featured === false) conditions.push(isNull(projectsProjects.featuredAt));
    if (filter.teamMemberId) {
      conditions.push(
        sql`exists (select 1 from ${projectsTeamMembers} where ${projectsTeamMembers.projectId} = ${projectsProjects.id}
          and ${projectsTeamMembers.userId} = ${filter.teamMemberId}
          and ${projectsTeamMembers.status} = 'active'
          and ${projectsTeamMembers.publicDisplayConsentAt} is not null)`,
      );
    }
    if (filter.sort === 'ending_soon') {
      // Open projects only, the nearest end first.
      conditions.push(inArray(projectsProjects.status, ['funding', 'funded']));
      if (after) {
        conditions.push(
          sql`(${projectsProjects.endsAt}, ${projectsProjects.id}) > (${after.at}, ${after.key}::uuid)`,
        );
      }
      const rows = await this.db
        .select()
        .from(projectsProjects)
        .where(and(...conditions))
        .orderBy(asc(projectsProjects.endsAt), asc(projectsProjects.id))
        .limit(limit);
      return rows.map(toProject);
    }
    if (after) {
      conditions.push(
        sql`(${projectsProjects.publishedAt}, ${projectsProjects.id}) < (${after.at}, ${after.key}::uuid)`,
      );
    }
    const rows = await this.db
      .select()
      .from(projectsProjects)
      .where(and(...conditions))
      .orderBy(desc(projectsProjects.publishedAt), desc(projectsProjects.id))
      .limit(limit);
    return rows.map(toProject);
  }

  async projectsOfMember(userId: string): Promise<ProjectRecord[]> {
    const rows = await this.db
      .select({ project: projectsProjects })
      .from(projectsTeamMembers)
      .innerJoin(projectsProjects, eq(projectsProjects.id, projectsTeamMembers.projectId))
      .where(
        and(
          eq(projectsTeamMembers.userId, userId),
          eq(projectsTeamMembers.status, 'active'),
          isNull(projectsProjects.deletedAt),
        ),
      )
      .orderBy(desc(projectsProjects.createdAt));
    return rows.map((row) => toProject(row.project));
  }

  async carriedBy(organizationId: string): Promise<ProjectRecord[]> {
    const rows = await this.db
      .select()
      .from(projectsProjects)
      .where(and(eq(projectsProjects.organizationId, organizationId), showable))
      .orderBy(desc(projectsProjects.publishedAt));
    return rows.map(toProject);
  }

  async endedOpenProjectIds(now: Date, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: projectsProjects.id })
      .from(projectsProjects)
      .where(
        and(
          inArray(projectsProjects.status, ['funding', 'funded']),
          isNull(projectsProjects.deletedAt),
          lte(projectsProjects.endsAt, now),
        ),
      )
      .orderBy(asc(projectsProjects.endsAt))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async endingSoonProjectIds(before: Date, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: projectsProjects.id })
      .from(projectsProjects)
      .where(
        and(
          inArray(projectsProjects.status, ['funding', 'funded']),
          isNull(projectsProjects.deletedAt),
          isNull(projectsProjects.endingSoonAt),
          lt(projectsProjects.endsAt, before),
        ),
      )
      .orderBy(asc(projectsProjects.endsAt))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async teamMembers(projectId: string): Promise<TeamMemberRecord[]> {
    const rows = await this.db
      .select()
      .from(projectsTeamMembers)
      .where(eq(projectsTeamMembers.projectId, projectId))
      .orderBy(
        sql`case ${projectsTeamMembers.role} when 'owner' then 0 else 1 end`,
        asc(projectsTeamMembers.invitedAt),
      );
    return rows.map(toMember);
  }

  async findTeamMember(projectId: string, userId: string): Promise<TeamMemberRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsTeamMembers)
      .where(
        and(eq(projectsTeamMembers.projectId, projectId), eq(projectsTeamMembers.userId, userId)),
      );
    return row ? toMember(row) : null;
  }

  async insertTeamMember(member: TeamMemberRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(projectsTeamMembers)
      .values(member)
      .onConflictDoNothing()
      .returning({ userId: projectsTeamMembers.userId });
    return inserted.length > 0;
  }

  async updateTeamMember(projectId: string, userId: string, patch: TeamMemberPatch): Promise<void> {
    await this.db
      .update(projectsTeamMembers)
      .set(patch)
      .where(
        and(eq(projectsTeamMembers.projectId, projectId), eq(projectsTeamMembers.userId, userId)),
      );
  }

  async deleteTeamMember(projectId: string, userId: string): Promise<void> {
    await this.db
      .delete(projectsTeamMembers)
      .where(
        and(eq(projectsTeamMembers.projectId, projectId), eq(projectsTeamMembers.userId, userId)),
      );
  }

  async countActiveOwners(projectId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(projectsTeamMembers)
      .where(
        and(
          eq(projectsTeamMembers.projectId, projectId),
          eq(projectsTeamMembers.role, 'owner'),
          eq(projectsTeamMembers.status, 'active'),
        ),
      );
    return row?.count ?? 0;
  }

  async invitationsOf(userId: string): Promise<TeamMemberRecord[]> {
    const rows = await this.db
      .select({ member: projectsTeamMembers })
      .from(projectsTeamMembers)
      .innerJoin(projectsProjects, eq(projectsProjects.id, projectsTeamMembers.projectId))
      .where(
        and(
          eq(projectsTeamMembers.userId, userId),
          eq(projectsTeamMembers.status, 'invited'),
          isNull(projectsProjects.deletedAt),
        ),
      )
      .orderBy(desc(projectsTeamMembers.invitedAt));
    return rows.map((row) => toMember(row.member));
  }

  async tiersOf(projectId: string): Promise<TierRecord[]> {
    return this.db
      .select()
      .from(projectsTiers)
      .where(eq(projectsTiers.projectId, projectId))
      .orderBy(asc(projectsTiers.position));
  }

  async replaceTiers(projectId: string, tiers: readonly TierRecord[]): Promise<void> {
    await this.db.delete(projectsTiers).where(eq(projectsTiers.projectId, projectId));
    if (tiers.length > 0) await this.db.insert(projectsTiers).values([...tiers]);
  }

  async markTiersUnlocked(ids: readonly string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(projectsTiers)
      .set({ unlockedAt: at })
      .where(and(inArray(projectsTiers.id, [...ids]), isNull(projectsTiers.unlockedAt)));
  }

  async rewardsOf(projectId: string): Promise<RewardRecord[]> {
    const rows = await this.db
      .select()
      .from(projectsRewards)
      .where(eq(projectsRewards.projectId, projectId))
      .orderBy(asc(projectsRewards.minAmountMinor), asc(projectsRewards.createdAt));
    return rows.map(toReward);
  }

  async findReward(id: string): Promise<RewardRecord | null> {
    const [row] = await this.db.select().from(projectsRewards).where(eq(projectsRewards.id, id));
    return row ? toReward(row) : null;
  }

  async lockReward(id: string): Promise<RewardRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsRewards)
      .where(eq(projectsRewards.id, id))
      .for('update');
    return row ? toReward(row) : null;
  }

  async insertReward(reward: RewardRecord): Promise<void> {
    await this.db.insert(projectsRewards).values(reward);
  }

  async updateReward(id: string, patch: RewardPatch, now: Date): Promise<void> {
    await this.db
      .update(projectsRewards)
      .set({ ...patch, updatedAt: now })
      .where(eq(projectsRewards.id, id));
  }

  async deleteReward(id: string): Promise<void> {
    await this.db.delete(projectsRewards).where(eq(projectsRewards.id, id));
  }

  async findReservation(contributionId: string): Promise<ReservationRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsRewardReservations)
      .where(eq(projectsRewardReservations.contributionId, contributionId));
    return row ? { ...row, status: row.status as ReservationStatus } : null;
  }

  async countReservations(rewardId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(projectsRewardReservations)
      .where(eq(projectsRewardReservations.rewardId, rewardId));
    return row?.count ?? 0;
  }

  async insertReservation(reservation: ReservationRecord): Promise<void> {
    await this.db.insert(projectsRewardReservations).values(reservation);
  }

  async setReservationStatus(
    contributionId: string,
    status: ReservationStatus,
    now: Date,
  ): Promise<void> {
    await this.db
      .update(projectsRewardReservations)
      .set({ status, updatedAt: now })
      .where(eq(projectsRewardReservations.contributionId, contributionId));
  }

  async findFundingEntry(contributionId: string): Promise<FundingEntryRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsFundingEntries)
      .where(eq(projectsFundingEntries.contributionId, contributionId));
    return row ?? null;
  }

  async insertFundingEntry(entry: FundingEntryRecord): Promise<void> {
    await this.db.insert(projectsFundingEntries).values(entry);
  }

  async findFundingReversal(reversalId: string): Promise<FundingReversalRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsFundingReversals)
      .where(eq(projectsFundingReversals.reversalId, reversalId));
    return row ?? null;
  }

  async insertFundingReversal(
    reversal: FundingReversalRecord,
    fullyReversed: boolean,
  ): Promise<void> {
    await this.db.insert(projectsFundingReversals).values(reversal);
    await this.db
      .update(projectsFundingEntries)
      .set({
        reversedMinor: sql`${projectsFundingEntries.reversedMinor} + ${reversal.amountMinor}`,
        ...(fullyReversed ? { reversedAt: reversal.reversedAt } : {}),
      })
      .where(eq(projectsFundingEntries.contributionId, reversal.contributionId));
  }

  async insertUpdate(update: UpdateRecord): Promise<void> {
    await this.db.insert(projectsUpdates).values(update);
  }

  async findUpdate(id: string): Promise<UpdateRecord | null> {
    const [row] = await this.db.select().from(projectsUpdates).where(eq(projectsUpdates.id, id));
    return row ? toUpdate(row) : null;
  }

  async findUpdates(ids: readonly string[]): Promise<UpdateRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(projectsUpdates)
      .where(inArray(projectsUpdates.id, [...ids]));
    return rows.map(toUpdate);
  }

  async updateUpdate(id: string, patch: UpdatePatch): Promise<void> {
    await this.db.update(projectsUpdates).set(patch).where(eq(projectsUpdates.id, id));
  }

  async updatesOf(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<UpdateRecord[]> {
    const rows = await this.db
      .select()
      .from(projectsUpdates)
      .where(
        and(
          eq(projectsUpdates.projectId, projectId),
          isNull(projectsUpdates.deletedAt),
          eq(projectsUpdates.moderationStatus, 'visible'),
          after
            ? sql`(${projectsUpdates.publishedAt}, ${projectsUpdates.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(projectsUpdates.publishedAt), desc(projectsUpdates.id))
      .limit(limit);
    return rows.map(toUpdate);
  }

  async feedUpdates(
    projectIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]> {
    if (projectIds.length === 0) return [];
    return this.db
      .select({ id: projectsUpdates.id, createdAt: projectsUpdates.publishedAt })
      .from(projectsUpdates)
      .innerJoin(projectsProjects, eq(projectsProjects.id, projectsUpdates.projectId))
      .where(
        and(
          inArray(projectsUpdates.projectId, [...projectIds]),
          isNull(projectsUpdates.deletedAt),
          eq(projectsUpdates.moderationStatus, 'visible'),
          showable,
          after
            ? sql`(${projectsUpdates.publishedAt}, ${projectsUpdates.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(projectsUpdates.publishedAt), desc(projectsUpdates.id))
      .limit(limit);
  }

  async insertInterest(interest: InterestRecord): Promise<void> {
    await this.db.insert(projectsInterests).values(interest);
  }

  async findInterest(id: string): Promise<InterestRecord | null> {
    const [row] = await this.db
      .select()
      .from(projectsInterests)
      .where(eq(projectsInterests.id, id));
    return row ? toInterest(row) : null;
  }

  async interestsOf(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<InterestRecord[]> {
    const rows = await this.db
      .select()
      .from(projectsInterests)
      .where(
        and(
          eq(projectsInterests.projectId, projectId),
          after
            ? sql`(${projectsInterests.createdAt}, ${projectsInterests.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(projectsInterests.createdAt), desc(projectsInterests.id))
      .limit(limit);
    return rows.map(toInterest);
  }
}
