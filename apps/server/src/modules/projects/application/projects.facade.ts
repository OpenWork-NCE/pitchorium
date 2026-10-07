import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type ProjectModerationStatus, uuidV7Schema } from '@pitchorium/contracts';
import { DomainError, type Money } from '../../../platform/kernel';
import { ContentFacade } from '../../content';
import { MediaFacade, type MediaResourceRef } from '../../media';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import type { ReservationStatus } from '../domain/rewards';
import { FundingService, type FundingSnapshot } from './funding.service';
import { PROJECT_INTEREST_RESOURCE } from './interests.service';
import { PROJECT_FOLLOW_TARGET, isShowable, ProjectReadsService } from './project-reads.service';
import { PROJECT_RESOURCE, ProjectsService } from './projects.service';
import { ProjectRepository } from './ports';
import { RewardsService } from './rewards.service';
import { PROJECT_UPDATE_RESOURCE, visibilityOf } from './updates.service';

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

  /** Reverses an applied contribution (refund, chargeback), once. */
  reverseFunding(contributionId: string): Promise<FundingSnapshot> {
    return this.funding.reverseFunding(contributionId);
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
