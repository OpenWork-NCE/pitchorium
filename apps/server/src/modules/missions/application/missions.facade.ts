import { Injectable } from '@nestjs/common';
import type { MissionCard, MissionModerationStatus } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { sidesOf } from '../domain/mission';
import { MissionUpdated } from '../domain/mission-events';
import { MissionEventsRecorder } from './mission-events.recorder';
import { MissionReadsService } from './mission-reads.service';
import { MissionsRepository } from './ports';

/** What the discovery module indexes of a mission (ADR 0065). */
export interface MissionDiscoverySource {
  id: string;
  direction: string;
  title: string;
  description: string;
  kind: string;
  domain: string;
  skills: string[];
  mode: string;
  countryCodes: string[];
  sectorCodes: string[];
  languages: string[];
  /** Visibility in force (`public` only with the author's public page). */
  visibility: 'public' | 'members';
  authorId: string;
  publishedAt: Date;
}

/** The two sides of an engagement, as the notifications module addresses them. */
export interface EngagementParties {
  engagementId: string;
  missionId: string;
  title: string;
  expertId: string;
  beneficiaryId: string;
  projectId: string | null;
  requesterId: string;
  responderId: string;
}

/**
 * Public facade of the missions module: sources of the search index (discovery), sides of an
 * engagement (notifications), moderation (trust).
 */
@Injectable()
export class MissionsFacade {
  constructor(
    private readonly missions: MissionsRepository,
    private readonly reads: MissionReadsService,
    private readonly recorder: MissionEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /** Indexable missions: open and visible; others are absent and the index drops them. */
  async discoverySources(ids: readonly string[]): Promise<MissionDiscoverySource[]> {
    const sources: MissionDiscoverySource[] = [];
    for (const mission of await this.missions.findMissions(ids)) {
      if (mission.status !== 'open' || mission.moderationStatus !== 'visible') continue;
      sources.push({
        id: mission.id,
        direction: mission.direction,
        title: mission.title,
        description: mission.description,
        kind: mission.kind,
        domain: mission.domain,
        skills: mission.skills,
        mode: mission.mode,
        countryCodes: mission.countryCodes,
        sectorCodes: mission.sectorCodes,
        languages: mission.languages,
        visibility: await this.reads.visibilityOf(mission),
        authorId: mission.authorId,
        publishedAt: mission.publishedAt,
      });
    }
    return sources;
  }

  /** Ids of every mission, by ascending id, for a full rebuild of the index. */
  idsAfter(after: string | null, limit: number): Promise<string[]> {
    return this.missions.idsAfter(after, limit);
  }

  async cards(ids: readonly string[]): Promise<Map<string, MissionCard>> {
    const cards = await this.reads.cards(await this.missions.findMissions(ids));
    return new Map(cards.map((card) => [card.id, card]));
  }

  async engagementParties(engagementId: string): Promise<EngagementParties | null> {
    const engagement = await this.missions.findEngagement(engagementId);
    const mission = engagement ? await this.missions.findMission(engagement.missionId) : null;
    if (!engagement || !mission) return null;
    return {
      engagementId,
      missionId: mission.id,
      title: mission.title,
      expertId: engagement.expertId,
      beneficiaryId: engagement.beneficiaryId,
      projectId: engagement.projectId,
      ...sidesOf(mission, engagement),
    };
  }

  /** For the trust module: a hidden or removed mission leaves the lists and the index. */
  /** Author of a mission, null when unknown (reports, trust module). */
  async authorOf(missionId: string): Promise<string | null> {
    return (await this.missions.findMission(missionId))?.authorId ?? null;
  }

  setModerationStatus(missionId: string, status: MissionModerationStatus): Promise<void> {
    return this.transactions.run(async () => {
      await this.missions.setModerationStatus(missionId, status, this.clock.now());
      await this.recorder.record(MissionUpdated, missionId, { fields: ['moderationStatus'] });
    });
  }
}
