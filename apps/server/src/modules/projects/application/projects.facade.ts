import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  type FundingInstrument,
  type ProjectModerationStatus,
  type ProjectStatus,
  type ProjectTeamRole,
  type RewardInstrument,
  uuidV7Schema,
} from '@pitchorium/contracts';
import { DomainError, Money } from '../../../platform/kernel';
import { ContentFacade } from '../../content';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import { isOpen } from '../domain/project';
import { available, type ReservationStatus } from '../domain/rewards';
import { type FundingReversal, FundingService, type FundingSnapshot } from './funding.service';
import { PROJECT_INTEREST_RESOURCE } from './interests.service';
import { PROJECT_FOLLOW_TARGET, isShowable, ProjectReadsService } from './project-reads.service';
import { PROJECT_RESOURCE, ProjectsService } from './projects.service';
import { ProjectRepository } from './ports';
import { RewardsService } from './rewards.service';
import { PROJECT_UPDATE_RESOURCE, visibilityOf } from './updates.service';

/** What the payments module needs to know of a project before and after a contribution. */
export interface FundableProject {
  id: string;
  slug: string;
  title: string;
  /** Displayed holder: the payout account and the KYC are theirs. */
  ownerId: string;
  organizationId: string | null;
  status: ProjectStatus;
  /** Label currency of the project (EUR, ADR 0037). */
  currency: string;
  instruments: FundingInstrument[];
  /** Published, not closed, live and visible: contributions are accepted. */
  open: boolean;
  /** Published, live and visible: the project shows to members. */
  showable: boolean;
  endsAt: Date | null;
}

export interface FundableReward {
  id: string;
  projectId: string;
  title: string;
  minAmount: Money;
  instruments: RewardInstrument[];
  /** Units left, null when unlimited. */
  available: number | null;
}

/**
 * Public facade of the projects module: collected amounts and reward reservations for the
 * payments module, moderation for trust. At startup it registers projects with network (follow
 * target), content (attachment of publications, updates of the feed), organizations (carried
 * projects) and media (read rules of private files).
 */
@Injectable()
export class ProjectsFacade implements OnModuleInit {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly reads: ProjectReadsService,
    private readonly writes: ProjectsService,
    private readonly funding: FundingService,
    private readonly rewards: RewardsService,
    private readonly network: NetworkFacade,
    private readonly content: ContentFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly media: MediaFacade,
  ) {}

  onModuleInit(): void {
    this.network.registerFollowTargetType({
      type: PROJECT_FOLLOW_TARGET,
      resolve: async (key) => {
        if (!uuidV7Schema.safeParse(key).success) return null;
        const project = await this.projects.findProject(key);
        return project && isShowable(project) ? project.id : null;
      },
      describe: async (ids) =>
        new Map(
          (await this.reads.cards(await this.showable(ids))).map((card) => [
            card.id,
            {
              key: card.id,
              displayName: card.title,
              subtitle: card.summary,
              imageUrl: card.coverImageUrl,
            },
          ]),
        ),
    });
    // Only the team of a published project attaches publications to it (section 10.3).
    this.content.registerProjectLinkValidator({
      canAttach: async (projectId, authorId) => {
        const project = await this.projects.findProject(projectId);
        return (
          project !== null &&
          isShowable(project) &&
          (await this.reads.teamRoleOf(projectId, authorId)) !== null
        );
      },
    });
    this.content.registerProjectUpdatesFeedSource({
      entries: async (viewerId, after, limit) =>
        this.projects.feedUpdates(
          await this.network.followedIds(viewerId, PROJECT_FOLLOW_TARGET),
          after,
          limit,
        ),
      present: (viewerId, ids) => this.reads.feedEntries(viewerId, ids),
    });
    this.organizations.registerProjectsProvider({
      carried: async (organizationId) =>
        (await this.projects.carriedBy(organizationId)).map((project) => ({
          projectId: project.id,
          slug: project.slug,
          title: project.title,
        })),
      // Projects supported by an organization come with its contributions (payments module).
      supported: () => Promise.resolve([]),
    });
    this.media.registerReadAuthorizer({
      resourceTypes: [PROJECT_RESOURCE, PROJECT_UPDATE_RESOURCE, PROJECT_INTEREST_RESOURCE],
      canRead: (viewerId, resource) => this.canReadFile(viewerId, resource),
    });
  }

  /** Applies a paid contribution, once per contribution (PROMPT 5, payments module). */
  applyFunding(contributionId: string, projectId: string, amount: Money): Promise<FundingSnapshot> {
    return this.funding.applyFunding(contributionId, projectId, amount);
  }

  /**
   * Reverses all of an applied contribution, or the part given by a reversal (partial refund,
   * lost dispute), once per reversal.
   */
  reverseFunding(contributionId: string, reversal?: FundingReversal): Promise<FundingSnapshot> {
    return this.funding.reverseFunding(contributionId, reversal);
  }

  /** Collected amount of a live project, null when unknown or deleted. */
  fundingSnapshot(projectId: string): Promise<FundingSnapshot | null> {
    return this.funding.snapshotOf(projectId);
  }

  async fundable(projectId: string): Promise<FundableProject | null> {
    return (await this.fundables([projectId])).get(projectId) ?? null;
  }

  /** Live projects by id (deleted ones are absent). */
  async fundables(projectIds: readonly string[]): Promise<Map<string, FundableProject>> {
    const projects = (await this.projects.findProjects(projectIds)).filter(
      (project) => !project.deletedAt,
    );
    return new Map(
      projects.map((project) => [
        project.id,
        {
          id: project.id,
          slug: project.slug,
          title: project.title,
          ownerId: project.ownerId,
          organizationId: project.organizationId,
          status: project.status,
          currency: project.currency,
          instruments: project.instruments,
          open: isOpen(project) && isShowable(project),
          showable: isShowable(project),
          endsAt: project.endsAt,
        },
      ]),
    );
  }

  async reward(rewardId: string): Promise<FundableReward | null> {
    const reward = await this.projects.findReward(rewardId);
    if (!reward) return null;
    const project = await this.projects.findProject(reward.projectId);
    if (!project || project.deletedAt) return null;
    return {
      id: reward.id,
      projectId: reward.projectId,
      title: reward.title,
      minAmount: Money.of(reward.minAmountMinor, project.currency),
      instruments: reward.instruments,
      available: available(reward),
    };
  }

  /** Live projects where the member is an active owner of the team. */
  async ownedProjectIds(userId: string): Promise<string[]> {
    const projects = await this.projects.projectsOfMember(userId);
    const roles = await Promise.all(
      projects.map((project) => this.reads.teamRoleOf(project.id, userId)),
    );
    return projects.filter((_, index) => roles[index] === 'owner').map((project) => project.id);
  }

  /** Active role of a member in the team of a project, null otherwise. */
  teamRoleOf(projectId: string, userId: string): Promise<ProjectTeamRole | null> {
    return this.reads.teamRoleOf(projectId, userId);
  }

  reserve(rewardId: string, contributionId: string): Promise<ReservationStatus> {
    return this.rewards.reserve(rewardId, contributionId);
  }

  confirm(contributionId: string): Promise<ReservationStatus> {
    return this.rewards.confirm(contributionId);
  }

  release(contributionId: string): Promise<ReservationStatus> {
    return this.rewards.release(contributionId);
  }

  setModerationStatus(projectId: string, status: ProjectModerationStatus): Promise<void> {
    return this.writes.setModerationStatus(projectId, status);
  }

  async setUpdateModerationStatus(
    updateId: string,
    status: ProjectModerationStatus,
  ): Promise<void> {
    const update = await this.projects.findUpdate(updateId);
    if (!update) throw new DomainError('PROJECTS_UPDATE_NOT_FOUND', 'Project update not found');
    await this.projects.updateUpdate(updateId, { moderationStatus: status });
  }

  private async showable(ids: readonly string[]) {
    return (await this.projects.findProjects(ids)).filter(isShowable);
  }

  /**
   * Gallery and update images of a published project are public; its documents are read by
   * signed-in members, those of a draft by its team. The documents of an expression of interest
   * are read by its author and the team.
   */
  private async canReadFile(viewerId: string, resource: MediaResourceRef): Promise<boolean> {
    let projectId = resource.id;
    if (resource.type === PROJECT_UPDATE_RESOURCE) {
      const update = await this.projects.findUpdate(resource.id);
      if (!update || update.deletedAt) return false;
      projectId = update.projectId;
    }
    if (resource.type === PROJECT_INTEREST_RESOURCE) {
      const interest = await this.projects.findInterest(resource.id);
      if (!interest) return false;
      if (interest.userId === viewerId) return true;
      return (await this.reads.teamRoleOf(interest.projectId, viewerId)) !== null;
    }
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt) return false;
    if (visibilityOf(project) === 'public') return true;
    return (await this.reads.teamRoleOf(projectId, viewerId)) !== null;
  }
}
