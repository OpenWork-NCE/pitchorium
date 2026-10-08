import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  MemberCard,
  MissionCard,
  MissionEngagement,
  MissionEngagementStatus,
  MissionListQuery,
  MissionView,
} from '@pitchorium/contracts';
import { decodeKeyset, encodeKeyset } from '../../../platform/kernel';
import { EngagementFacade } from '../../engagement';
import { NetworkFacade } from '../../network';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { type EngagementRecord, effectiveVisibility, type MissionRecord } from '../domain/mission';
import { MissionsRepository } from './ports';

/** Who reads: a signed-in member, or an anonymous visitor of a public mission. */
export type MissionReader = { kind: 'member'; viewerId: string } | { kind: 'public' };

const OPEN_STATUSES: readonly MissionEngagementStatus[] = ['requested', 'accepted'];

/**
 * Reads of the missions: who manages a mission (its author, or the team of its project), what
 * a reader may see (members by default, public with the author's public page, nothing across a
 * block, moderated missions for their managers only), cards, pages and engagements.
 */
@Injectable()
export class MissionReadsService {
  constructor(
    private readonly missions: MissionsRepository,
    private readonly profiles: ProfilesFacade,
    private readonly projects: ProjectsFacade,
    private readonly network: NetworkFacade,
    private readonly engagement: EngagementFacade,
  ) {}

  /** The author, or an owner or editor of the project the request is for. */
  async canManage(mission: MissionRecord, userId: string): Promise<boolean> {
    if (mission.authorId === userId) return true;
    return (
      mission.projectId !== null &&
      (await this.projects.teamRoleOf(mission.projectId, userId)) !== null
    );
  }

  async visibilityOf(mission: MissionRecord) {
    const card = (await this.profiles.memberCards([mission.authorId])).get(mission.authorId);
    return effectiveVisibility(mission.visibility, card?.publicPageEnabled === true);
  }

  async canSee(mission: MissionRecord, reader: MissionReader): Promise<boolean> {
    if (reader.kind === 'member' && (await this.canManage(mission, reader.viewerId))) return true;
    if (mission.moderationStatus !== 'visible') return false;
    if (reader.kind === 'public') {
      return mission.status === 'open' && (await this.visibilityOf(mission)) === 'public';
    }
    return !(await this.network.isBlockedBetween(reader.viewerId, mission.authorId));
  }

  async byId(missionId: string, reader: MissionReader): Promise<MissionView | null> {
    const mission = await this.missions.findMission(missionId);
    if (!mission || !(await this.canSee(mission, reader))) return null;
    return this.view(mission, reader);
  }

  /** Open missions, newest first; public ones only without session. */
  async list(query: MissionListQuery, reader: MissionReader): Promise<CursorPage<MissionCard>> {
    const rows = await this.missions.listOpen(
      {
        direction: query.direction,
        kind: query.kind,
        mode: query.mode,
        sectorCode: query.sectorCode,
        countryCode: query.countryCode,
        language: query.language,
        publicOnly: reader.kind === 'public',
        hiddenAuthorIds:
          reader.kind === 'member' ? await this.network.blockedUserIds(reader.viewerId) : [],
      },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const shown = [];
    for (const mission of page) {
      if (reader.kind === 'member' || (await this.visibilityOf(mission)) === 'public') {
        shown.push(mission);
      }
    }
    const last = page.at(-1);
    return {
      items: await this.cards(shown),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.publishedAt, key: last.id })
          : null,
    };
  }

  async mine(
    userId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<MissionCard>> {
    const rows = await this.missions.authoredBy(
      userId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.cards(page),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.publishedAt, key: last.id })
          : null,
    };
  }

  async cards(missions: readonly MissionRecord[]): Promise<MissionCard[]> {
    const [members, projects] = await Promise.all([
      this.profiles.memberCards(missions.map((mission) => mission.authorId)),
      this.projects.fundables(
        missions.flatMap((mission) => (mission.projectId ? [mission.projectId] : [])),
      ),
    ]);
    return missions.flatMap((mission) => {
      const author = members.get(mission.authorId);
      if (!author) return [];
      const project = mission.projectId ? projects.get(mission.projectId) : undefined;
      return [
        {
          id: mission.id,
          direction: mission.direction,
          title: mission.title,
          kind: mission.kind,
          domain: mission.domain,
          format: mission.format,
          mode: mission.mode,
          estimatedHours: mission.estimatedHours,
          sectorCodes: mission.sectorCodes,
          countryCodes: mission.countryCodes,
          languages: mission.languages,
          status: mission.status,
          author: {
            member: card(author),
            project:
              project?.showable === true
                ? { id: project.id, slug: project.slug, title: project.title }
                : null,
          },
          publishedAt: mission.publishedAt.toISOString(),
        },
      ];
    });
  }

  async view(mission: MissionRecord, reader: MissionReader): Promise<MissionView> {
    const [cardView] = await this.cards([mission]);
    const viewerId = reader.kind === 'member' ? reader.viewerId : null;
    const [manager, own] = await Promise.all([
      viewerId ? this.canManage(mission, viewerId) : Promise.resolve(false),
      viewerId
        ? this.missions.engagementsOfMember(viewerId, [mission.id])
        : Promise.resolve(new Map<string, EngagementRecord>()),
    ]);
    const engagement = own.get(mission.id);
    const open = engagement !== undefined && OPEN_STATUSES.includes(engagement.status);
    return {
      ...cardView!,
      description: mission.description,
      skills: mission.skills,
      desiredBy: mission.desiredBy,
      capacity: mission.capacity,
      activeEngagements: mission.activeEngagements,
      visibility: await this.visibilityOf(mission),
      closedAt: mission.closedAt?.toISOString() ?? null,
      viewer: viewerId
        ? {
            isAuthor: manager,
            engagementId: engagement?.id ?? null,
            canEngage: !manager && mission.status === 'open' && !open,
          }
        : null,
      updatedAt: mission.updatedAt.toISOString(),
    };
  }

  async engagementView(engagement: EngagementRecord): Promise<MissionEngagement> {
    const [view] = await this.engagementViews([engagement]);
    return view!;
  }

  async engagementViews(rows: readonly EngagementRecord[]): Promise<MissionEngagement[]> {
    const missions = new Map(
      (await this.missions.findMissions([...new Set(rows.map((row) => row.missionId))])).map(
        (mission) => [mission.id, mission],
      ),
    );
    const [missionCards, members, projects, entries] = await Promise.all([
      this.cards([...missions.values()]),
      this.profiles.memberCards(rows.flatMap((row) => [row.expertId, row.beneficiaryId])),
      this.projects.fundables(rows.flatMap((row) => (row.projectId ? [row.projectId] : []))),
      this.engagement.timeEntries(
        rows.flatMap((row) => (row.timeEntryId ? [row.timeEntryId] : [])),
      ),
    ]);
    const cardOf = new Map(missionCards.map((item) => [item.id, item]));
    return rows.flatMap((row) => {
      const mission = cardOf.get(row.missionId);
      const expert = members.get(row.expertId);
      const beneficiary = members.get(row.beneficiaryId);
      if (!mission || !expert || !beneficiary) return [];
      const project = row.projectId ? projects.get(row.projectId) : undefined;
      const entry = row.timeEntryId ? entries.get(row.timeEntryId) : undefined;
      return [
        {
          id: row.id,
          mission,
          status: row.status,
          expert: card(expert),
          beneficiary: card(beneficiary),
          project: project ? { id: project.id, slug: project.slug, title: project.title } : null,
          message: row.message,
          answerMessage: row.answerMessage,
          timeEntry: entry ? { id: entry.id, minutes: entry.minutes, status: entry.status } : null,
          requestedAt: row.requestedAt.toISOString(),
          answeredAt: row.answeredAt?.toISOString() ?? null,
          endedAt: row.endedAt?.toISOString() ?? null,
        },
      ];
    });
  }

  async engagementsOfMission(
    missionId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<MissionEngagement>> {
    return this.engagementPage(
      await this.missions.engagementsOfMission(
        missionId,
        decodeKeyset(query.cursor),
        query.limit + 1,
      ),
      query.limit,
    );
  }

  async engagementsOf(
    userId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      role?: 'expert' | 'beneficiary' | undefined;
      status?: MissionEngagementStatus | undefined;
    },
  ): Promise<CursorPage<MissionEngagement>> {
    return this.engagementPage(
      await this.missions.engagementsOf(
        userId,
        { role: query.role, status: query.status },
        decodeKeyset(query.cursor),
        query.limit + 1,
      ),
      query.limit,
    );
  }

  private async engagementPage(
    rows: readonly EngagementRecord[],
    limit: number,
  ): Promise<CursorPage<MissionEngagement>> {
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: await this.engagementViews(page),
      nextCursor:
        rows.length > limit && last ? encodeKeyset({ at: last.requestedAt, key: last.id }) : null,
    };
  }
}

function card(member: {
  handle: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
}): MemberCard {
  return {
    handle: member.handle,
    displayName: member.displayName,
    headline: member.headline,
    avatarUrl: member.avatarUrl,
  };
}
