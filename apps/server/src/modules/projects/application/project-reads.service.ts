import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  CursorPageQuery,
  MyProject,
  Project,
  ProjectCard,
  ProjectImage,
  ProjectInterest,
  ProjectInvitation,
  ProjectReward,
  ProjectShowcaseQuery,
  ProjectTeamRole,
  ProjectUpdate,
  ProjectUpdateFeedEntry,
} from '@pitchorium/contracts';
import {
  Clock,
  decodeCursor,
  DomainError,
  encodeKeyset,
  decodeKeyset,
  keysetFrom,
} from '../../../platform/kernel';
import { ImpactFacade } from '../../impact';
import { type MediaImage, MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { OrganizationsFacade } from '../../organizations';
import { type MemberCard, ProfilesFacade } from '../../profiles';
import type { InterestRecord, UpdateRecord } from '../domain/activity';
import { available, type RewardRecord } from '../domain/rewards';
import {
  daysLeft,
  isPublished,
  progressPercent,
  type ProjectRecord,
  type TeamMemberRecord,
} from '../domain/project';
import { shownOnPage } from '../domain/team';
import { videoView } from '../domain/video';
import { ProjectRepository, type ShowcaseFilter } from './ports';

/** Follow target type of projects in the network module (ADR 0027). */
export const PROJECT_FOLLOW_TARGET = 'project';

/** Latest updates embedded in the project page. */
const PAGE_UPDATES = 5;

/** Who reads a project page: a visitor, a signed-in member, or a member of its team. */
export type Audience = { kind: 'public' } | { kind: 'member'; viewerId: string };

export type ProjectLookup = { kind: 'found'; view: Project } | { kind: 'moved'; slug: string };

const notFound = () => new DomainError('PROJECTS_NOT_FOUND', 'Project not found');

const memberCardView = (card: MemberCard | undefined) =>
  card
    ? {
        handle: card.handle,
        displayName: card.displayName,
        headline: card.headline,
        avatarUrl: card.avatarUrl,
      }
    : null;

const imageView = (mediaId: string, image: MediaImage | undefined): ProjectImage[] =>
  image ? [{ mediaId, url: image.url, variants: image.variants }] : [];

/** Published, live and visible: readable by anyone. */
export function isShowable(project: ProjectRecord): boolean {
  return isPublished(project) && !project.deletedAt && project.moderationStatus === 'visible';
}

/**
 * Read side of projects: cards, the project page with every block of section 11.2, the
 * showcase, the updates and the expressions of interest. Drafts and hidden projects are read
 * by their team only; the public display of the team follows their consent (ADR 0040).
 */
@Injectable()
export class ProjectReadsService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly media: MediaFacade,
    private readonly network: NetworkFacade,
    private readonly impact: ImpactFacade,
    private readonly clock: Clock,
  ) {}

  /** Role of an active member in the team of a live project, null otherwise. */
  async teamRoleOf(projectId: string, userId: string): Promise<ProjectTeamRole | null> {
    const member = await this.projects.findTeamMember(projectId, userId);
    return member?.status === 'active' ? member.role : null;
  }

  async bySlug(slug: string, audience: Audience): Promise<ProjectLookup> {
    const resolved = await this.projects.resolveSlug(slug);
    const project = resolved ? await this.projects.findProject(resolved.projectId) : null;
    if (!resolved || !project || !(await this.readable(project, audience))) throw notFound();
    if (!resolved.current) return { kind: 'moved', slug: project.slug };
    return { kind: 'found', view: await this.page(project, audience, false) };
  }

  /** Management view for the team, or the member view of a readable project. */
  async byId(projectId: string, viewerId: string): Promise<Project> {
    const project = await this.projects.findProject(projectId);
    const audience: Audience = { kind: 'member', viewerId };
    if (!project || !(await this.readable(project, audience))) throw notFound();
    return this.page(project, audience, false);
  }

  /** The public page as a visitor would see it, also for a draft: for the team only. */
  async preview(projectId: string): Promise<Project> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt) throw notFound();
    return this.page(project, { kind: 'public' }, true);
  }

  /** 404 unless the project is published, live and visible. */
  async requireShowable(projectId: string): Promise<void> {
    const project = await this.projects.findProject(projectId);
    if (!project || !isShowable(project)) throw notFound();
  }

  async showcase(query: ProjectShowcaseQuery): Promise<CursorPage<ProjectCard>> {
    const filter: ShowcaseFilter = {
      sort: query.sort,
      ...(query.countryCode ? { countryCode: query.countryCode } : {}),
      ...(query.sectorCode ? { sectorCode: query.sectorCode } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
    };
    // Without a published methodology, scores are not shown and the impact filter is ignored.
    if (query.minImpact !== undefined && (await this.impact.publishedMethodology())) {
      filter.minImpact = query.minImpact;
    }
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const after = cursor ? keysetFrom(cursor) : null;
    const rows = await this.projects.showcase(filter, after, query.limit + 1);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const at = last ? (query.sort === 'ending_soon' ? last.endsAt : last.publishedAt) : null;
    return {
      items: await this.cards(page),
      nextCursor:
        rows.length > query.limit && last && at ? encodeKeyset({ at, key: last.id }) : null,
    };
  }

  async mine(userId: string): Promise<MyProject[]> {
    const projects = await this.projects.projectsOfMember(userId);
    const cards = new Map((await this.cards(projects)).map((card) => [card.id, card]));
    const roles = await Promise.all(projects.map((project) => this.teamRoleOf(project.id, userId)));
    return projects.flatMap((project, index) => {
      const card = cards.get(project.id);
      const role = roles[index];
      return card && role ? [{ project: card, role }] : [];
    });
  }

  async invitations(userId: string): Promise<ProjectInvitation[]> {
    const invitations = await this.projects.invitationsOf(userId);
    const projects = await this.projects.findProjects(invitations.map((item) => item.projectId));
    const [cards, inviters] = await Promise.all([
      this.cards(projects),
      this.profiles.memberCards(
        invitations.flatMap((item) => (item.invitedBy ? [item.invitedBy] : [])),
        userId,
      ),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    return invitations.flatMap((invitation) => {
      const project = byId.get(invitation.projectId);
      return project
        ? [
            {
              project,
              role: invitation.role,
              function: invitation.function,
              invitedBy: memberCardView(
                invitation.invitedBy ? inviters.get(invitation.invitedBy) : undefined,
              ),
              invitedAt: invitation.invitedAt.toISOString(),
            },
          ]
        : [];
    });
  }

  /** Updates of a readable project, newest first. */
  async updates(
    projectId: string,
    audience: Audience,
    query: CursorPageQuery,
  ): Promise<CursorPage<ProjectUpdate>> {
    const project = await this.projects.findProject(projectId);
    if (!project || !(await this.readable(project, audience))) throw notFound();
    const rows = await this.projects.updatesOf(
      projectId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.updateViews(page, viewerOf(audience)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.publishedAt, key: last.id })
          : null,
    };
  }

  /** Updates for the feed of a reader, with their project, by id (content feed source). */
  async feedEntries(
    viewerId: string,
    ids: readonly string[],
  ): Promise<Map<string, ProjectUpdateFeedEntry>> {
    const updates = await this.projects.findUpdates(ids);
    const projects = new Map(
      (await this.projects.findProjects(updates.map((update) => update.projectId))).map(
        (project) => [project.id, project],
      ),
    );
    const shown = updates.filter((update) => {
      const project = projects.get(update.projectId);
      return project && isShowable(project) && !update.deletedAt;
    });
    const covers = await this.media.images(
      [...projects.values()].map((project) => project.galleryMediaIds[0] ?? null),
    );
    const views = await this.updateViews(shown, viewerId);
    const entries = new Map<string, ProjectUpdateFeedEntry>();
    for (const view of views) {
      const project = projects.get(view.projectId);
      if (!project) continue;
      const coverId = project.galleryMediaIds[0];
      entries.set(view.id, {
        ...view,
        project: {
          id: project.id,
          slug: project.slug,
          title: project.title,
          coverImageUrl: coverId ? (covers.get(coverId)?.url ?? null) : null,
        },
      });
    }
    return entries;
  }

  async interests(projectId: string, query: CursorPageQuery): Promise<CursorPage<ProjectInterest>> {
    const rows = await this.projects.interestsOf(
      projectId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const cards = await this.profiles.memberCards(page.map((interest) => interest.userId));
    const last = page.at(-1);
    return {
      items: page.flatMap((interest) => interestView(interest, cards.get(interest.userId))),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  /** Cards in the order given; drafts are only listed to their team by the callers. */
  async cards(projects: readonly ProjectRecord[]): Promise<ProjectCard[]> {
    if (projects.length === 0) return [];
    const [owners, organizations, covers, methodology] = await Promise.all([
      this.profiles.memberCards(projects.map((project) => project.ownerId)),
      this.organizations.cards(
        projects.flatMap((project) => (project.organizationId ? [project.organizationId] : [])),
      ),
      this.media.images(projects.map((project) => project.galleryMediaIds[0] ?? null)),
      this.impact.publishedMethodology(),
    ]);
    const now = this.clock.now();
    return projects.map((project): ProjectCard => {
      const organization = project.organizationId
        ? organizations.get(project.organizationId)
        : undefined;
      const coverId = project.galleryMediaIds[0];
      return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        summary: project.summary,
        status: project.status,
        sectorCode: project.sectorCode,
        countryCodes: project.countryCodes,
        coverImageUrl: coverId ? (covers.get(coverId)?.url ?? null) : null,
        owner: memberCardView(owners.get(project.ownerId)),
        organization: organization
          ? {
              id: organization.id,
              slug: organization.slug,
              name: organization.name,
              logoUrl: organization.logoUrl,
              verified: organization.verified,
            }
          : null,
        funding: {
          goal:
            project.goalMinor === null
              ? null
              : { amountMinor: String(project.goalMinor), currency: project.currency },
          collected: { amountMinor: String(project.collectedMinor), currency: project.currency },
          progressPercent: progressPercent(project.collectedMinor, project.goalMinor),
          contributionCount: project.contributionCount,
          daysLeft: daysLeft(project.endsAt, now),
          instruments: project.instruments,
          opensCapital: project.opensCapital,
        },
        impact:
          methodology && project.impactScore !== null && project.impactLevel !== null
            ? {
                selfDeclared: true,
                score: project.impactScore,
                level: project.impactLevel,
                methodologyVersion: project.impactMethodologyVersion ?? methodology.version,
              }
            : null,
        featured: project.featuredAt !== null,
        publishedAt: project.publishedAt?.toISOString() ?? null,
        endsAt: project.endsAt?.toISOString() ?? null,
      };
    });
  }

  /**
   * A live project is readable when it is showable, or by an active member of its team (draft,
   * hidden project, preview).
   */
  private async readable(project: ProjectRecord, audience: Audience): Promise<boolean> {
    if (project.deletedAt || project.moderationStatus === 'removed') return false;
    if (isShowable(project)) return true;
    if (audience.kind === 'public') return false;
    return (await this.teamRoleOf(project.id, audience.viewerId)) !== null;
  }

  private async page(
    project: ProjectRecord,
    audience: Audience,
    preview: boolean,
  ): Promise<Project> {
    const viewerId = viewerOf(audience);
    const teamRole = viewerId ? await this.teamRoleOf(project.id, viewerId) : null;
    const [card] = await this.cards([project]);
    if (!card) throw notFound();
    const [team, tiers, rewards, updates, gallery, impactAssessment, following] = await Promise.all(
      [
        this.projects.teamMembers(project.id),
        this.projects.tiersOf(project.id),
        this.projects.rewardsOf(project.id),
        this.projects.updatesOf(project.id, null, PAGE_UPDATES),
        this.media.images(project.galleryMediaIds),
        this.impact.current({ type: 'project', id: project.id }),
        viewerId
          ? this.network
              .followedIds(viewerId, PROJECT_FOLLOW_TARGET)
              .then((ids) => ids.includes(project.id))
          : Promise.resolve(false),
      ],
    );
    // In the preview, the team sees every active member; visitors see those who consented.
    // A draft is read by its team only: every active member is shown, as in the preview.
    const shown = team.filter((member) => shownOnPage(member, !isPublished(project)));
    const [cards, documents, updateViews] = await Promise.all([
      this.profiles.memberCards(shown.map((member) => member.userId)),
      audience.kind === 'member' && !preview ? this.documents(project) : Promise.resolve([]),
      this.updateViews(updates, viewerId),
    ]);
    const firstImage = project.galleryMediaIds[0];
    return {
      ...card,
      description: project.description,
      impactArea: project.impactArea,
      video: project.video ? videoView(project.video) : null,
      gallery: project.galleryMediaIds.flatMap((mediaId) =>
        imageView(mediaId, gallery.get(mediaId)),
      ),
      documents,
      tiers: tiers.map((tier) => ({
        id: tier.id,
        position: tier.position,
        threshold: { amountMinor: String(tier.thresholdMinor), currency: project.currency },
        description: tier.description,
        unlocked: project.collectedMinor >= tier.thresholdMinor,
        unlockedAt: tier.unlockedAt?.toISOString() ?? null,
      })),
      rewards: rewards.map((reward) => rewardView(reward, project.currency)),
      updates: updateViews,
      team: shown.flatMap((member) => {
        const view = memberCardView(cards.get(member.userId));
        return view ? [{ member: view, role: member.role, function: member.function }] : [];
      }),
      impactAssessment,
      share: {
        title: project.title,
        description: project.summary,
        imageUrl: firstImage ? (gallery.get(firstImage)?.url ?? null) : null,
      },
      viewer: viewerId && !preview ? { following, teamRole } : null,
      management: teamRole && !preview ? await this.management(project, teamRole, team) : null,
    };
  }

  private async management(
    project: ProjectRecord,
    role: ProjectTeamRole,
    team: TeamMemberRecord[],
  ) {
    const invited = team.filter((member) => member.status === 'invited');
    const cards = await this.profiles.memberCards(invited.map((member) => member.userId));
    return {
      viewerRole: role,
      moderationStatus: project.moderationStatus,
      durationDays: project.durationDays,
      fundingLocked: project.firstContributionAt !== null,
      publicDisplayConsentAt: project.publicDisplayConsentAt?.toISOString() ?? null,
      invitations: invited.flatMap((member) => {
        const view = memberCardView(cards.get(member.userId));
        return view ? [{ member: view, role: member.role, function: member.function }] : [];
      }),
      impactAssessmentRequired:
        (await this.impact.publishedMethodology()) !== null && project.impactScore === null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private async documents(project: ProjectRecord) {
    const [summaries, thumbnails] = await Promise.all([
      Promise.all(project.documentMediaIds.map((mediaId) => this.media.describe(mediaId))),
      this.media.images(project.documentMediaIds),
    ]);
    return summaries.flatMap((summary) =>
      summary
        ? [
            {
              mediaId: summary.id,
              pageCount: summary.pageCount,
              thumbnailUrl: thumbnails.get(summary.id)?.url ?? null,
            },
          ]
        : [],
    );
  }

  async presentUpdate(update: UpdateRecord): Promise<ProjectUpdate> {
    const [view] = await this.updateViews([update], null);
    if (!view) throw notFound();
    return view;
  }

  async presentInterest(interest: InterestRecord): Promise<ProjectInterest> {
    const cards = await this.profiles.memberCards([interest.userId]);
    const [view] = interestView(interest, cards.get(interest.userId));
    if (!view) throw notFound();
    return view;
  }

  private async updateViews(
    updates: readonly UpdateRecord[],
    viewerId: string | null,
  ): Promise<ProjectUpdate[]> {
    if (updates.length === 0) return [];
    const [authors, images] = await Promise.all([
      this.profiles.memberCards(
        updates.map((update) => update.authorId),
        viewerId,
      ),
      this.media.images(updates.flatMap((update) => update.imageMediaIds)),
    ]);
    return updates.flatMap((update) => {
      const author = memberCardView(authors.get(update.authorId));
      return author
        ? [
            {
              id: update.id,
              projectId: update.projectId,
              author,
              text: update.text,
              images: update.imageMediaIds.flatMap((mediaId) =>
                imageView(mediaId, images.get(mediaId)),
              ),
              publishedAt: update.publishedAt.toISOString(),
              editedAt: update.editedAt?.toISOString() ?? null,
            },
          ]
        : [];
    });
  }
}

export function rewardView(reward: RewardRecord, currency: string): ProjectReward {
  const left = available(reward);
  return {
    id: reward.id,
    title: reward.title,
    description: reward.description,
    minAmount: { amountMinor: String(reward.minAmountMinor), currency },
    instruments: reward.instruments,
    quantity: reward.quantity,
    available: left,
    soldOut: left === 0,
    estimatedDelivery: reward.estimatedDelivery,
  };
}

function viewerOf(audience: Audience): string | null {
  return audience.kind === 'member' ? audience.viewerId : null;
}

function interestView(interest: InterestRecord, card: MemberCard | undefined): ProjectInterest[] {
  const member = memberCardView(card);
  if (!member) return [];
  return [
    {
      id: interest.id,
      kind: interest.kind,
      member,
      message: interest.message,
      indicativeAmount:
        interest.indicativeAmountMinor !== null && interest.indicativeCurrency
          ? {
              amountMinor: String(interest.indicativeAmountMinor),
              currency: interest.indicativeCurrency,
            }
          : null,
      documents: interest.documentMediaIds.map((mediaId) => ({ mediaId })),
      createdAt: interest.createdAt.toISOString(),
    },
  ];
}
