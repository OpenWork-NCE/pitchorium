import { Injectable } from '@nestjs/common';
import type { DiscoveryKind, SuggestionList } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { personProfileOf } from '../domain/match-profile';
import {
  CANDIDATE_CAP,
  type EventProfile,
  isSuggested,
  type Match,
  MATCHING_RULES_VERSION,
  matchComplementary,
  matchContributor,
  matchEvent,
  matchMission,
  matchPerson,
  matchProject,
  type MissionProfile,
  type PersonProfile,
  type ProjectProfile,
  REVERSE_CAP,
  SUGGESTIONS_PER_LIST,
} from '../domain/matching';
import { tagValues } from '../domain/search-documents';
import {
  DiscoveryRepository,
  type ListName,
  type StoredDocument,
  type SubjectRef,
  type SuggestionRow,
} from './ports';

export function projectProfileOf(document: StoredDocument): ProjectProfile {
  return {
    projectId: document.entityId,
    title: document.name,
    ownerId: document.ownerId,
    sector: document.sectorCodes[0] ?? null,
    countries: document.countryCodes,
    instruments: tagValues(document.tags, 'instrument'),
    goal:
      document.amountMinor !== null && document.currency !== null
        ? { minor: document.amountMinor, currency: document.currency }
        : null,
  };
}

export function missionProfileOf(document: StoredDocument): MissionProfile {
  return {
    missionId: document.entityId,
    title: document.name,
    authorId: document.ownerId,
    direction: tagValues(document.tags, 'direction')[0] === 'request' ? 'request' : 'offer',
    kind: tagValues(document.tags, 'kind')[0] === 'mentoring' ? 'mentoring' : 'expertise',
    sectors: document.sectorCodes,
    countries: document.countryCodes,
    remote: tagValues(document.tags, 'mode')[0] === 'remote',
    languages: tagValues(document.tags, 'lang'),
  };
}

export function eventProfileOf(document: StoredDocument): EventProfile {
  return {
    eventId: document.entityId,
    title: document.name,
    organizerId: document.ownerId,
    sectors: document.sectorCodes,
    countries: document.countryCodes,
    language: tagValues(document.tags, 'lang')[0] ?? '',
  };
}

/** The best suggested candidates of a list, by score then id (a stable order). */
function best(
  candidates: readonly { kind: DiscoveryKind; id: string; match: Match }[],
): SuggestionRow[] {
  return candidates
    .filter((candidate) => isSuggested(candidate.match))
    .sort((a, b) => b.match.score - a.match.score || (a.id < b.id ? -1 : 1))
    .slice(0, SUGGESTIONS_PER_LIST)
    .map((candidate) => row(candidate.kind, candidate.id, candidate.match));
}

function row(kind: DiscoveryKind, id: string, match: Match): SuggestionRow {
  return {
    candidateKind: kind,
    candidateId: id,
    score: match.score,
    reasons: match.reasons,
    rulesVersion: MATCHING_RULES_VERSION,
  };
}

/**
 * Precomputed suggestions (ADR 0068): each list of a subject keeps its best candidates. A full
 * computation generates candidates by indexed filters (at most CANDIDATE_CAP per list), scores
 * them with the rules of the domain and keeps SUGGESTIONS_PER_LIST. When a candidate changes,
 * only its row is updated in the lists of the subjects it may concern (at most REVERSE_CAP).
 * Connections, blocks and dismissals are applied when the lists are read.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /** Every list of a member, from scratch. */
  async recomputeMember(userId: string): Promise<void> {
    const [record] = await this.discovery.matchProfiles([userId]);
    const subject: SubjectRef = { type: 'member', id: userId };
    if (!record) {
      await this.transactions.run(() => this.discovery.deleteSubjectSuggestions(subject));
      return;
    }
    const viewer = personProfileOf(record, false);
    const now = this.clock.now();
    const people =
      viewer.entrepreneur || viewer.contributor
        ? await this.discovery.peopleCandidates(viewer, CANDIDATE_CAP)
        : [];
    const complementary = viewer.entrepreneur
      ? await this.discovery.complementaryCandidates(viewer, CANDIDATE_CAP)
      : [];
    const projects = viewer.contributor
      ? await this.discovery.projectCandidates(viewer, CANDIDATE_CAP)
      : [];
    const missions = await this.discovery.missionCandidates(viewer, CANDIDATE_CAP);
    const events = await this.discovery.eventCandidates(viewer, now, CANDIDATE_CAP);
    const lists: Record<SuggestionList, SuggestionRow[]> = {
      people: best(
        people.map((candidate) => ({
          kind: 'person' as const,
          id: candidate.userId,
          match: matchPerson(viewer, personProfileOf(candidate, true)),
        })),
      ),
      complementary_entrepreneurs: best(
        complementary.map((candidate) => ({
          kind: 'person' as const,
          id: candidate.userId,
          match: matchComplementary(viewer, personProfileOf(candidate, true)),
        })),
      ),
      projects: best(
        projects.map((document) => ({
          kind: 'project' as const,
          id: document.entityId,
          match: matchProject(viewer, projectProfileOf(document)),
        })),
      ),
      missions: best(
        missions.map((document) => ({
          kind: 'mission' as const,
          id: document.entityId,
          match: matchMission(viewer, missionProfileOf(document)),
        })),
      ),
      events: best(
        events.map((document) => ({
          kind: 'event' as const,
          id: document.entityId,
          match: matchEvent(viewer, eventProfileOf(document)),
        })),
      ),
    };
    await this.transactions.run(async () => {
      for (const [list, rows] of Object.entries(lists) as [SuggestionList, SuggestionRow[]][]) {
        await this.discovery.replaceSuggestions(subject, list, rows, now);
      }
    });
  }

  /** Potential contributors of a project, from scratch (shown to its team). */
  async recomputeProject(projectId: string): Promise<void> {
    const subject: SubjectRef = { type: 'project', id: projectId };
    const [document] = await this.discovery.documents('project', [projectId], 'members');
    if (!document) {
      await this.transactions.run(() => this.discovery.deleteSubjectSuggestions(subject));
      return;
    }
    const project = projectProfileOf(document);
    const candidates = await this.discovery.contributorCandidates(project, CANDIDATE_CAP);
    const rows = best(
      candidates.map((candidate) => ({
        kind: 'person' as const,
        id: candidate.userId,
        match: matchContributor(project, personProfileOf(candidate, true)),
      })),
    );
    await this.transactions.run(() =>
      this.discovery.replaceSuggestions(subject, 'contributors', rows, this.clock.now()),
    );
  }

  /**
   * A candidate changed: its row is recomputed in the lists of the subjects it may concern,
   * found by the same indexed filters seen from the candidate (the relations are symmetric).
   */
  async candidateChanged(kind: DiscoveryKind, id: string): Promise<void> {
    switch (kind) {
      case 'person':
        return this.personChanged(id);
      case 'project':
        return this.projectChanged(id);
      case 'mission':
        return this.missionChanged(id);
      case 'event':
        return this.eventChanged(id);
      case 'organization':
        return;
    }
  }

  private async personChanged(userId: string): Promise<void> {
    const [record] = await this.discovery.matchProfiles([userId]);
    if (!record) return;
    const asViewer = personProfileOf(record, false);
    const asCandidate = personProfileOf(record, true);
    const [people, complementary, projects] = await Promise.all([
      this.discovery.peopleCandidates(asViewer, REVERSE_CAP),
      asViewer.entrepreneur
        ? this.discovery.complementaryCandidates(asViewer, REVERSE_CAP)
        : Promise.resolve([]),
      asViewer.contributor
        ? this.discovery.projectCandidates(asViewer, REVERSE_CAP)
        : Promise.resolve([]),
    ]);
    const updates: Update[] = [
      ...people.map((other) => ({
        subject: member(other.userId),
        list: 'people' as const,
        match: matchPerson(personProfileOf(other, false), asCandidate),
      })),
      ...complementary.map((other) => ({
        subject: member(other.userId),
        list: 'complementary_entrepreneurs' as const,
        match: matchComplementary(personProfileOf(other, false), asCandidate),
      })),
      ...projects.map((document) => ({
        subject: { type: 'project' as const, id: document.entityId },
        list: 'contributors' as const,
        match: matchContributor(projectProfileOf(document), asCandidate),
      })),
    ];
    await this.apply('person', userId, updates);
  }

  private async projectChanged(projectId: string): Promise<void> {
    const [document] = await this.discovery.documents('project', [projectId], 'members');
    if (!document) return;
    const project = projectProfileOf(document);
    const viewers = await this.discovery.contributorCandidates(project, REVERSE_CAP);
    await this.apply(
      'project',
      projectId,
      viewers.map((viewer) => ({
        subject: member(viewer.userId),
        list: 'projects' as const,
        match: matchProject(personProfileOf(viewer, false), project),
      })),
    );
  }

  private async missionChanged(missionId: string): Promise<void> {
    const [document] = await this.discovery.documents('mission', [missionId], 'members');
    if (!document) return;
    const mission = missionProfileOf(document);
    const viewers = await this.discovery.membersForMission(mission, REVERSE_CAP);
    await this.apply(
      'mission',
      missionId,
      viewers.map((viewer) => ({
        subject: member(viewer.userId),
        list: 'missions' as const,
        match: matchMission(personProfileOf(viewer, false), mission),
      })),
    );
  }

  private async eventChanged(eventId: string): Promise<void> {
    const [document] = await this.discovery.documents('event', [eventId], 'members');
    if (!document || document.status !== 'published') return;
    const event = eventProfileOf(document);
    const viewers = await this.discovery.membersForEvent(event, REVERSE_CAP);
    await this.apply(
      'event',
      eventId,
      viewers.map((viewer) => ({
        subject: member(viewer.userId),
        list: 'events' as const,
        match: matchEvent(personProfileOf(viewer, false), event),
      })),
    );
  }

  /**
   * Upserts or deletes the candidate's row in each list, then keeps the best of the list. A
   * list that suggested the candidate but is no longer concerned loses it.
   */
  private async apply(kind: DiscoveryKind, id: string, updates: readonly Update[]): Promise<void> {
    const now = this.clock.now();
    const concerned = new Set(
      updates.map((update) => `${update.subject.type}:${update.subject.id}:${update.list}`),
    );
    const stale = (await this.discovery.subjectsWithCandidate(kind, id)).filter(
      (entry) => !concerned.has(`${entry.subject.type}:${entry.subject.id}:${entry.list}`),
    );
    await this.transactions.run(async () => {
      for (const entry of stale) {
        await this.discovery.deleteSuggestion(entry.subject, entry.list, kind, id);
      }
      for (const update of updates) {
        if (isSuggested(update.match)) {
          await this.discovery.upsertSuggestion(
            update.subject,
            update.list,
            row(kind, id, update.match),
            now,
          );
          await this.discovery.trimSuggestions(update.subject, update.list, SUGGESTIONS_PER_LIST);
        } else {
          await this.discovery.deleteSuggestion(update.subject, update.list, kind, id);
        }
      }
    });
  }
}

interface Update {
  subject: SubjectRef;
  list: ListName;
  match: Match;
}

const member = (id: string): SubjectRef => ({ type: 'member', id });

export type { PersonProfile };
