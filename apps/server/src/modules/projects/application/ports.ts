import type { ProjectStatus, ProjectSort } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { InterestRecord, UpdateRecord } from '../domain/activity';
import type { TierRecord } from '../domain/funding';
import type { ProjectRecord, TeamMemberRecord } from '../domain/project';
import type { ReservationRecord, ReservationStatus, RewardRecord } from '../domain/rewards';

export type ProjectPatch = Partial<Omit<ProjectRecord, 'id' | 'slug' | 'createdAt' | 'updatedAt'>>;
export type RewardPatch = Partial<
  Pick<
    RewardRecord,
    | 'title'
    | 'description'
    | 'minAmountMinor'
    | 'instruments'
    | 'quantity'
    | 'reserved'
    | 'confirmed'
    | 'estimatedDelivery'
  >
>;
export type TeamMemberPatch = Partial<
  Pick<TeamMemberRecord, 'role' | 'function' | 'status' | 'joinedAt' | 'publicDisplayConsentAt'>
>;
export type UpdatePatch = Partial<
  Pick<UpdateRecord, 'text' | 'moderationStatus' | 'editedAt' | 'deletedAt' | 'imageMediaIds'>
>;

/** Filters of the showcase (published, live and visible projects only). */
export interface ShowcaseFilter {
  countryCode?: string;
  sectorCode?: string;
  status?: Exclude<ProjectStatus, 'draft'>;
  /** Ignored by the caller when no methodology is published. */
  minImpact?: number;
  featured?: boolean;
  sort: ProjectSort;
}

/** Position of the last project of a showcase page: its sort date and id. */
export type ShowcasePosition = KeysetPosition;

export abstract class ProjectRepository {
  /** Transaction-scoped advisory lock. */
  abstract lock(key: string): Promise<void>;

  /** False when the slug is taken (nothing inserted). */
  abstract insertProject(project: ProjectRecord): Promise<boolean>;
  abstract findProject(id: string): Promise<ProjectRecord | null>;
  abstract findProjects(ids: readonly string[]): Promise<ProjectRecord[]>;
  /** Every project that is not deleted, by ascending id (search index rebuild). */
  abstract idsAfter(after: string | null, limit: number): Promise<string[]>;
  /** Locks the row until the end of the transaction (SELECT ... FOR UPDATE). */
  abstract lockProject(id: string): Promise<ProjectRecord | null>;
  abstract updateProject(id: string, patch: ProjectPatch, now: Date): Promise<void>;
  /** Current slug first, then former slugs. */
  abstract resolveSlug(slug: string): Promise<{ projectId: string; current: boolean } | null>;
  abstract isSlugUnavailable(slug: string, forProjectId: string | null): Promise<boolean>;
  abstract changeSlug(id: string, previous: string, next: string, now: Date): Promise<void>;
  abstract showcase(
    filter: ShowcaseFilter,
    after: ShowcasePosition | null,
    limit: number,
  ): Promise<ProjectRecord[]>;
  /** Live projects in whose team the member is active, with their role. */
  abstract projectsOfMember(userId: string): Promise<ProjectRecord[]>;
  /** Published, live and visible projects carried by an organization. */
  abstract carriedBy(organizationId: string): Promise<ProjectRecord[]>;
  /** Open projects whose end date passed. */
  abstract endedOpenProjectIds(now: Date, limit: number): Promise<string[]>;
  /** Open projects ending before `before`, not yet announced as ending soon. */
  abstract endingSoonProjectIds(before: Date, limit: number): Promise<string[]>;

  abstract teamMembers(projectId: string): Promise<TeamMemberRecord[]>;
  abstract findTeamMember(projectId: string, userId: string): Promise<TeamMemberRecord | null>;
  /** False when the member is already in the team or invited. */
  abstract insertTeamMember(member: TeamMemberRecord): Promise<boolean>;
  abstract updateTeamMember(
    projectId: string,
    userId: string,
    patch: TeamMemberPatch,
  ): Promise<void>;
  abstract deleteTeamMember(projectId: string, userId: string): Promise<void>;
  abstract countActiveOwners(projectId: string): Promise<number>;
  /** Pending invitations of a member to live projects. */
  abstract invitationsOf(userId: string): Promise<TeamMemberRecord[]>;

  abstract tiersOf(projectId: string): Promise<TierRecord[]>;
  abstract replaceTiers(projectId: string, tiers: readonly TierRecord[]): Promise<void>;
  abstract markTiersUnlocked(ids: readonly string[], at: Date): Promise<void>;

  abstract rewardsOf(projectId: string): Promise<RewardRecord[]>;
  abstract findReward(id: string): Promise<RewardRecord | null>;
  abstract lockReward(id: string): Promise<RewardRecord | null>;
  abstract insertReward(reward: RewardRecord): Promise<void>;
  abstract updateReward(id: string, patch: RewardPatch, now: Date): Promise<void>;
  abstract deleteReward(id: string): Promise<void>;
  abstract findReservation(contributionId: string): Promise<ReservationRecord | null>;
  abstract countReservations(rewardId: string): Promise<number>;
  abstract insertReservation(reservation: ReservationRecord): Promise<void>;
  abstract setReservationStatus(
    contributionId: string,
    status: ReservationStatus,
    now: Date,
  ): Promise<void>;

  abstract findFundingEntry(contributionId: string): Promise<FundingEntryRecord | null>;
  abstract insertFundingEntry(entry: FundingEntryRecord): Promise<void>;
  abstract findFundingReversal(reversalId: string): Promise<FundingReversalRecord | null>;
  /** Records a reversal and adds it to the reversed amount of its entry. */
  abstract insertFundingReversal(
    reversal: FundingReversalRecord,
    fullyReversed: boolean,
  ): Promise<void>;

  abstract insertUpdate(update: UpdateRecord): Promise<void>;
  abstract findUpdate(id: string): Promise<UpdateRecord | null>;
  abstract findUpdates(ids: readonly string[]): Promise<UpdateRecord[]>;
  abstract updateUpdate(id: string, patch: UpdatePatch): Promise<void>;
  /** Visible updates of a project, newest first. */
  abstract updatesOf(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<UpdateRecord[]>;
  /** Visible updates of published and visible projects among `projectIds`, newest first. */
  abstract feedUpdates(
    projectIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; createdAt: Date }[]>;

  abstract insertInterest(interest: InterestRecord): Promise<void>;
  abstract findInterest(id: string): Promise<InterestRecord | null>;
  /** Newest first. */
  abstract interestsOf(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<InterestRecord[]>;
}

export interface FundingEntryRecord {
  contributionId: string;
  projectId: string;
  amountMinor: bigint;
  currency: string;
  appliedAt: Date;
  reversedMinor: bigint;
  reversedAt: Date | null;
}

export interface FundingReversalRecord {
  reversalId: string;
  contributionId: string;
  amountMinor: bigint;
  currency: string;
  reversedAt: Date;
}
