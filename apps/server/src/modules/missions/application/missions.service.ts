import { Injectable } from '@nestjs/common';
import type {
  CreateMissionRequest,
  MissionDirection,
  UpdateMissionRequest,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { EngagementFacade } from '../../engagement';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import {
  assertExpertHat,
  assertFields,
  assertHours,
  assertNotAJobPosting,
  assertTransition,
  type EngagementRecord,
  effectiveVisibility,
  type MissionRecord,
  sidesOf,
} from '../domain/mission';
import {
  EngagementAccepted,
  EngagementCanceled,
  EngagementCompleted,
  EngagementDeclined,
  EngagementRequested,
  MissionClosed,
  MissionPublished,
  MissionUpdated,
} from '../domain/mission-events';
import { MissionEventsRecorder } from './mission-events.recorder';
import { MissionsRepository } from './ports';

const notFound = () => new DomainError('MISSIONS_NOT_FOUND', 'Mission not found');
const engagementNotFound = () =>
  new DomainError('MISSIONS_ENGAGEMENT_NOT_FOUND', 'Mission engagement not found');

/**
 * Volunteer missions (§6.3, §14, ADR 0071): offers of experts and mentors, requests of
 * entrepreneurs and project teams; an application or a solicitation, an answer, the mission in
 * progress, then its completion with the time declared once in the shared time log (engagement
 * module), or its cancellation.
 */
@Injectable()
export class MissionsService {
  constructor(
    private readonly missions: MissionsRepository,
    private readonly recorder: MissionEventsRecorder,
    private readonly profiles: ProfilesFacade,
    private readonly projects: ProjectsFacade,
    private readonly engagement: EngagementFacade,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(
    userId: string,
    direction: MissionDirection,
    request: Omit<CreateMissionRequest, 'direction'>,
  ): Promise<MissionRecord> {
    const fields = { direction, ...request };
    assertFields(fields);
    assertHours(request.format, request.estimatedHours);
    assertNotAJobPosting(request.title, request.description, request.domain, ...request.skills);
    await this.profiles.assertSectors(request.sectorCodes);
    await this.profiles.assertCountries(request.countryCodes);
    if (direction === 'offer') {
      if (request.projectId) {
        throw new DomainError('MISSIONS_FIELDS_INVALID', 'An offer is not made for a project');
      }
      assertExpertHat(request.kind, await this.hatsOf(userId));
    } else {
      await this.assertBeneficiary(userId, request.projectId);
    }
    if (request.visibility === 'public') await this.assertPublicAuthor(userId);
    const now = this.clock.now();
    const mission: MissionRecord = {
      id: this.ids.next(),
      direction,
      authorId: userId,
      projectId: request.projectId,
      title: request.title,
      description: request.description,
      kind: request.kind,
      domain: request.domain,
      sectorCodes: request.sectorCodes,
      format: request.format,
      estimatedHours: request.estimatedHours,
      mode: request.mode,
      countryCodes: request.countryCodes,
      languages: request.languages,
      capacity: request.capacity,
      skills: request.skills,
      desiredBy: request.desiredBy,
      visibility: request.visibility,
      status: 'open',
      moderationStatus: 'visible',
      activeEngagements: 0,
      publishedAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.transactions.run(async () => {
      await this.missions.insertMission(mission);
      await this.recorder.record(MissionPublished, mission.id, {
        authorId: userId,
        direction,
        projectId: request.projectId,
      });
    });
    return mission;
  }

  async update(missionId: string, request: UpdateMissionRequest): Promise<void> {
    const fields = Object.keys(request).filter(
      (key) => request[key as keyof UpdateMissionRequest] !== undefined,
    );
    if (fields.length === 0) return;
    await this.transactions.run(async () => {
      const mission = await this.lock(missionId);
      if (mission.status !== 'open') throw new DomainError('MISSIONS_CLOSED', 'Mission is closed');
      const next = { ...mission, ...stripUndefined(request) };
      assertFields(next);
      assertHours(next.format, next.estimatedHours);
      assertNotAJobPosting(next.title, next.description, next.domain, ...next.skills);
      if (request.sectorCodes) await this.profiles.assertSectors(request.sectorCodes);
      if (request.countryCodes) await this.profiles.assertCountries(request.countryCodes);
      if (request.kind && mission.direction === 'offer') {
        assertExpertHat(request.kind, await this.hatsOf(mission.authorId));
      }
      if (request.capacity !== undefined && request.capacity < mission.activeEngagements) {
        throw new DomainError(
          'MISSIONS_FIELDS_INVALID',
          'Capacity below the engagements in progress',
        );
      }
      if (request.visibility === 'public') await this.assertPublicAuthor(mission.authorId);
      await this.missions.updateMission(missionId, {
        ...stripUndefined(request),
        updatedAt: this.clock.now(),
      });
      await this.recorder.record(MissionUpdated, missionId, { fields });
    });
  }

  /** No new engagement; those in progress go on. */
  async close(missionId: string, userId: string): Promise<void> {
    await this.transactions.run(async () => {
      const mission = await this.lock(missionId);
      if (mission.status === 'closed') return;
      const now = this.clock.now();
      await this.missions.updateMission(missionId, {
        status: 'closed',
        closedAt: now,
        updatedAt: now,
      });
      await this.recorder.record(MissionClosed, missionId, { by: userId });
    });
  }

  /**
   * An application to a request (the member gives their time: hat required), or a solicitation
   * of an offer (the member is helped: entrepreneur facet, or the team of the project named).
   */
  async request(
    missionId: string,
    userId: string,
    request: { message: string; projectId: string | null },
  ): Promise<EngagementRecord> {
    assertNotAJobPosting(request.message);
    return this.transactions.run(async () => {
      const mission = await this.lock(missionId);
      if (mission.status !== 'open' || mission.moderationStatus !== 'visible') {
        throw new DomainError('MISSIONS_CLOSED', 'Mission is closed');
      }
      if (mission.authorId === userId) {
        throw new DomainError('MISSIONS_OWN_MISSION', 'You cannot engage on your own mission');
      }
      let expertId: string;
      let beneficiaryId: string;
      let projectId: string | null;
      if (mission.direction === 'request') {
        if (request.projectId) {
          throw new DomainError('MISSIONS_FIELDS_INVALID', 'The project is the one of the request');
        }
        assertExpertHat(mission.kind, await this.hatsOf(userId));
        expertId = userId;
        beneficiaryId = mission.authorId;
        projectId = mission.projectId;
      } else {
        await this.assertBeneficiary(userId, request.projectId);
        expertId = mission.authorId;
        beneficiaryId = userId;
        projectId = request.projectId;
      }
      if (projectId && (await this.projects.fundable(projectId))?.ownerId === expertId) {
        throw new DomainError('MISSIONS_OWN_MISSION', 'The expert owns the project');
      }
      if (await this.missions.openEngagement(missionId, expertId, beneficiaryId)) {
        throw new DomainError('MISSIONS_ENGAGEMENT_EXISTS', 'An engagement is already open');
      }
      const now = this.clock.now();
      const engagement: EngagementRecord = {
        id: this.ids.next(),
        missionId,
        expertId,
        beneficiaryId,
        projectId,
        status: 'requested',
        message: request.message,
        answerMessage: null,
        timeEntryId: null,
        requestedAt: now,
        answeredAt: null,
        endedAt: null,
        updatedAt: now,
      };
      await this.missions.insertEngagement(engagement);
      await this.recorder.record(EngagementRequested, engagement.id, {
        missionId,
        ...sidesOf(mission, engagement),
      });
      return engagement;
    });
  }

  /** By the author of the mission; an offer keeps to its capacity of missions in progress. */
  async answer(
    engagementId: string,
    answer: 'accepted' | 'declined',
    message: string | null,
  ): Promise<void> {
    if (message) assertNotAJobPosting(message);
    await this.transactions.run(async () => {
      const engagement = await this.lockEngagement(engagementId);
      const mission = await this.lock(engagement.missionId);
      assertTransition(engagement.status, answer);
      if (answer === 'accepted' && mission.activeEngagements >= mission.capacity) {
        throw new DomainError('MISSIONS_CAPACITY_REACHED', 'The mission has no capacity left');
      }
      const now = this.clock.now();
      await this.missions.updateEngagement(engagementId, {
        status: answer,
        answerMessage: message,
        answeredAt: now,
        updatedAt: now,
      });
      if (answer === 'accepted') {
        await this.missions.updateMission(mission.id, {
          activeEngagements: mission.activeEngagements + 1,
        });
      }
      const payload = { missionId: mission.id, ...sidesOf(mission, engagement) };
      if (answer === 'accepted') {
        await this.recorder.record(EngagementAccepted, engagementId, payload);
      } else {
        await this.recorder.record(EngagementDeclined, engagementId, payload);
      }
    });
  }

  /** Asked: withdrawn by the member who asked; in progress: stopped by either side. */
  async cancel(engagementId: string, userId: string): Promise<void> {
    await this.transactions.run(async () => {
      const engagement = await this.lockEngagement(engagementId);
      const mission = await this.lock(engagement.missionId);
      assertTransition(engagement.status, 'canceled');
      if (
        engagement.status === 'requested' &&
        sidesOf(mission, engagement).requesterId !== userId
      ) {
        throw new DomainError('MISSIONS_INVALID_TRANSITION', 'The author answers, not cancels');
      }
      const now = this.clock.now();
      await this.missions.updateEngagement(engagementId, {
        status: 'canceled',
        endedAt: now,
        updatedAt: now,
      });
      if (engagement.status === 'accepted') {
        await this.missions.updateMission(mission.id, {
          activeEngagements: Math.max(0, mission.activeEngagements - 1),
        });
      }
      await this.recorder.record(EngagementCanceled, engagementId, {
        missionId: mission.id,
        by: userId,
      });
    });
  }

  /**
   * By the expert: the time is declared in the shared time log (engagement module), in the same
   * transaction, then confirmed or disputed there by the beneficiary.
   */
  async complete(
    engagementId: string,
    declaration: { minutes: number; date: string; description: string },
  ): Promise<void> {
    await this.transactions.run(async () => {
      const engagement = await this.lockEngagement(engagementId);
      const mission = await this.lock(engagement.missionId);
      assertTransition(engagement.status, 'completed');
      const entry = await this.engagement.declareTime({
        contributorId: engagement.expertId,
        beneficiary: engagement.projectId
          ? { projectId: engagement.projectId, entrepreneurId: null }
          : { projectId: null, entrepreneurId: engagement.beneficiaryId },
        kind: mission.kind,
        minutes: declaration.minutes,
        date: declaration.date,
        description: declaration.description,
        missionEngagementId: engagementId,
      });
      const now = this.clock.now();
      await this.missions.updateEngagement(engagementId, {
        status: 'completed',
        timeEntryId: entry.id,
        endedAt: now,
        updatedAt: now,
      });
      await this.missions.updateMission(mission.id, {
        activeEngagements: Math.max(0, mission.activeEngagements - 1),
      });
      await this.recorder.record(EngagementCompleted, engagementId, {
        missionId: mission.id,
        expertId: engagement.expertId,
        beneficiaryId: engagement.beneficiaryId,
        projectId: engagement.projectId,
        timeEntryId: entry.id,
      });
    });
  }

  private async hatsOf(userId: string): Promise<string[]> {
    const [source] = await this.profiles.sources([userId]);
    return source?.contributor?.hats ?? [];
  }

  /** An entrepreneur for themself, or a member of the team for their project. */
  private async assertBeneficiary(userId: string, projectId: string | null): Promise<void> {
    if (projectId) {
      const role = await this.projects.teamRoleOf(projectId, userId);
      const project = await this.projects.fundable(projectId);
      if (!role || !project?.showable) {
        throw new DomainError(
          'MISSIONS_PROJECT_ROLE_REQUIRED',
          'Member of the project team required',
        );
      }
      return;
    }
    const [source] = await this.profiles.sources([userId]);
    if (!source?.entrepreneur) {
      throw new DomainError(
        'MISSIONS_BENEFICIARY_REQUIRED',
        'An entrepreneur facet or a project team is required',
      );
    }
  }

  private async assertPublicAuthor(userId: string): Promise<void> {
    const card = (await this.profiles.memberCards([userId])).get(userId);
    if (effectiveVisibility('public', card?.publicPageEnabled === true) !== 'public') {
      throw new DomainError('MISSIONS_FIELDS_INVALID', 'A public mission needs a public page');
    }
  }

  private async lock(missionId: string): Promise<MissionRecord> {
    const mission = await this.missions.lockMission(missionId);
    if (!mission) throw notFound();
    return mission;
  }

  private async lockEngagement(engagementId: string): Promise<EngagementRecord> {
    const engagement = await this.missions.lockEngagement(engagementId);
    if (!engagement) throw engagementNotFound();
    return engagement;
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
