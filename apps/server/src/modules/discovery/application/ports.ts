import type {
  DiscoverSection,
  DiscoveryKind,
  SuggestionList,
  SuggestionReason,
} from '@pitchorium/contracts';
import type { MatchProfileRecord } from '../domain/match-profile';
import type {
  EventProfile,
  MissionProfile,
  PersonProfile,
  ProjectProfile,
} from '../domain/matching';
import type { Audience, SearchDocument } from '../domain/search-documents';

/** A document ready to store: its labels (weight D) and the hash of its content. */
export interface IndexedDocument extends SearchDocument {
  labels: string;
  fingerprint: string;
}

/** A stored document, without its text. */
export type StoredDocument = Omit<SearchDocument, 'body'> & { fingerprint: string };

export interface SearchHit extends StoredDocument {
  score: number;
}

/** Filters of the search (ADR 0066); a kind-specific filter applies to its kind only. */
export interface SearchCriteria {
  audience: Audience;
  kinds: readonly DiscoveryKind[];
  /** Normalized query (lower case, no accent); null to browse with filters only. */
  normalized: string | null;
  /** Prefix full-text query, null without term. */
  tsQuery: string | null;
  countryCode?: string | undefined;
  sectorCode?: string | undefined;
  language?: string | undefined;
  projectStatus?: string | undefined;
  minImpact?: number | undefined;
  facet?: 'entrepreneur' | 'contributor' | undefined;
  hat?: string | undefined;
  mentoring?: boolean | undefined;
  structureType?: string | undefined;
  verified?: boolean | undefined;
  eventFormat?: string | undefined;
  includePast: boolean;
  missionDirection?: string | undefined;
  missionKind?: string | undefined;
  missionMode?: string | undefined;
  /** Members hidden from the reader (blocks): their entities are left out. */
  hiddenOwnerIds: readonly string[];
  now: Date;
  offset: number;
  limit: number;
}

/** Whose suggestions: a member, or a project for its potential contributors. */
export interface SubjectRef {
  type: 'member' | 'project';
  id: string;
}

/** Lists of a member, plus the potential contributors of a project. */
export type ListName = SuggestionList | 'contributors';

export interface SuggestionRow {
  candidateKind: DiscoveryKind;
  candidateId: string;
  score: number;
  reasons: SuggestionReason[];
  rulesVersion: number;
}

export abstract class DiscoveryRepository {
  /** Replaces the documents of an entity (one per audience; an absent audience is removed). */
  abstract replaceDocuments(
    kind: DiscoveryKind,
    entityId: string,
    documents: readonly IndexedDocument[],
    at: Date,
  ): Promise<void>;
  abstract deleteDocuments(kind: DiscoveryKind, entityId: string): Promise<boolean>;
  /** Stored fingerprints per entity, audiences joined in a stable order. */
  abstract fingerprints(
    kind: DiscoveryKind,
    entityIds: readonly string[],
  ): Promise<Map<string, string>>;
  /** Indexed entities of a kind, by ascending id (orphans of the drift check). */
  abstract indexedIdsAfter(
    kind: DiscoveryKind,
    after: string | null,
    limit: number,
  ): Promise<string[]>;
  abstract documents(
    kind: DiscoveryKind,
    entityIds: readonly string[],
    audience: Audience,
  ): Promise<StoredDocument[]>;
  abstract documentByKey(
    kind: DiscoveryKind,
    key: string,
    audience: Audience,
  ): Promise<StoredDocument | null>;
  abstract search(criteria: SearchCriteria): Promise<SearchHit[]>;
  abstract autocomplete(criteria: {
    audience: Audience;
    normalized: string;
    kinds: readonly DiscoveryKind[];
    hiddenOwnerIds: readonly string[];
    limit: number;
  }): Promise<StoredDocument[]>;
  abstract section(criteria: {
    audience: Audience;
    section: Exclude<DiscoverSection, 'suggested_profiles'>;
    hiddenOwnerIds: readonly string[];
    now: Date;
    offset: number;
    limit: number;
  }): Promise<StoredDocument[]>;

  abstract upsertMatchProfile(profile: MatchProfileRecord, at: Date): Promise<void>;
  abstract deleteMatchProfile(userId: string): Promise<void>;
  abstract matchProfiles(userIds: readonly string[]): Promise<MatchProfileRecord[]>;
  /** Members whose facets may match the viewer (indexed filters, capped). */
  abstract peopleCandidates(viewer: PersonProfile, cap: number): Promise<MatchProfileRecord[]>;
  abstract complementaryCandidates(
    viewer: PersonProfile,
    cap: number,
  ): Promise<MatchProfileRecord[]>;
  abstract contributorCandidates(
    project: ProjectProfile,
    cap: number,
  ): Promise<MatchProfileRecord[]>;
  abstract membersForMission(mission: MissionProfile, cap: number): Promise<MatchProfileRecord[]>;
  abstract membersForEvent(event: EventProfile, cap: number): Promise<MatchProfileRecord[]>;
  /** Open projects, open missions and upcoming events that may match the viewer. */
  abstract projectCandidates(viewer: PersonProfile, cap: number): Promise<StoredDocument[]>;
  abstract missionCandidates(viewer: PersonProfile, cap: number): Promise<StoredDocument[]>;
  abstract eventCandidates(
    viewer: PersonProfile,
    now: Date,
    cap: number,
  ): Promise<StoredDocument[]>;

  /** Replaces a list; the first suggestion date of a candidate already present is kept. */
  abstract replaceSuggestions(
    subject: SubjectRef,
    list: ListName,
    rows: readonly SuggestionRow[],
    at: Date,
  ): Promise<void>;
  abstract upsertSuggestion(
    subject: SubjectRef,
    list: ListName,
    row: SuggestionRow,
    at: Date,
  ): Promise<void>;
  abstract deleteSuggestion(
    subject: SubjectRef,
    list: ListName,
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<void>;
  /** Keeps the best `keep` suggestions of a list. */
  abstract trimSuggestions(subject: SubjectRef, list: ListName, keep: number): Promise<void>;
  abstract deleteSubjectSuggestions(subject: SubjectRef): Promise<void>;
  /** Lists in which the candidate is suggested today. */
  abstract subjectsWithCandidate(
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<{ subject: SubjectRef; list: ListName }[]>;
  /** A candidate left the index: it leaves every list. */
  abstract removeCandidate(candidateKind: DiscoveryKind, candidateId: string): Promise<void>;
  /**
   * A page of a list, best first: candidates still indexed for members, neither dismissed by
   * the member nor in `excludedIds` (connections, blocks).
   */
  abstract suggestions(
    subject: SubjectRef,
    list: ListName,
    options: {
      dismissedBy: string | null;
      excludedIds: readonly string[];
      offset: number;
      limit: number;
    },
  ): Promise<(SuggestionRow & { firstSuggestedAt: Date })[]>;
  abstract addDismissal(
    userId: string,
    candidateKind: DiscoveryKind,
    candidateId: string,
    at: Date,
  ): Promise<boolean>;
  abstract removeDismissal(
    userId: string,
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<boolean>;
  /** Members whose lists received candidates within the window, with their number. */
  abstract newSuggestionCounts(from: Date, to: Date): Promise<{ userId: string; count: number }[]>;
}
