import { Injectable } from '@nestjs/common';
import {
  type DiscoveryKind,
  NEED_TO_HATS,
  type SuggestionReason,
  type VisibilityLevel,
} from '@pitchorium/contracts';
import { and, asc, eq, gt, inArray, sql, type SQL } from '@pitchorium/db/orm';
import {
  discoveryDismissals,
  discoveryMatchProfiles,
  discoverySearchDocuments,
  discoverySuggestions,
} from '@pitchorium/db/schemas/discovery';
import { TransactionManager } from '../../../platform/database';
import {
  DiscoveryRepository,
  type IndexedDocument,
  type ListName,
  type SearchCriteria,
  type SearchHit,
  type StoredDocument,
  type SubjectRef,
  type SuggestionRow,
} from '../application/ports';
import type { MatchProfileRecord } from '../domain/match-profile';
import type {
  EventProfile,
  MissionProfile,
  PersonProfile,
  ProjectProfile,
} from '../domain/matching';
import type { Audience } from '../domain/search-documents';
import {
  NAME_PREFIX_BONUS,
  NAME_SIMILARITY_THRESHOLD,
  NAME_SIMILARITY_WEIGHT,
  RANK_WEIGHTS_ARRAY,
} from '../domain/search-query';

const documents = discoverySearchDocuments;
const profiles = discoveryMatchProfiles;
const suggestions = discoverySuggestions;
const dismissals = discoveryDismissals;

type DocumentRow = typeof documents.$inferSelect;
type ProfileRow = typeof profiles.$inferSelect;

const toStored = (row: Omit<DocumentRow, 'document' | 'indexedAt'>): StoredDocument => ({
  kind: row.kind as DiscoveryKind,
  entityId: row.entityId,
  audience: row.audience as Audience,
  key: row.key,
  ownerId: row.ownerId,
  name: row.name,
  subtitle: row.subtitle,
  countryCodes: row.countryCodes,
  sectorCodes: row.sectorCodes,
  tags: row.tags,
  status: row.status,
  impactScore: row.impactScore,
  amountMinor: row.amountMinor,
  currency: row.currency,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  publishedAt: row.publishedAt,
  featuredAt: row.featuredAt,
  fingerprint: row.fingerprint,
});

const toProfile = (row: ProfileRow): MatchProfileRecord => ({
  ...row,
  entrepreneurVisibility: row.entrepreneurVisibility as VisibilityLevel,
  contributorVisibility: row.contributorVisibility as VisibilityLevel,
});

/** Columns of a document without its text vector. */
const stored = {
  kind: documents.kind,
  entityId: documents.entityId,
  audience: documents.audience,
  key: documents.key,
  ownerId: documents.ownerId,
  name: documents.name,
  nameNormalized: documents.nameNormalized,
  subtitle: documents.subtitle,
  countryCodes: documents.countryCodes,
  sectorCodes: documents.sectorCodes,
  tags: documents.tags,
  status: documents.status,
  impactScore: documents.impactScore,
  amountMinor: documents.amountMinor,
  currency: documents.currency,
  startsAt: documents.startsAt,
  endsAt: documents.endsAt,
  publishedAt: documents.publishedAt,
  featuredAt: documents.featuredAt,
  fingerprint: documents.fingerprint,
};

/** One array parameter (a bare JS array would expand to a list of parameters). */
const textArray = (values: readonly string[]) => sql`${sql.param([...values])}::text[]`;
const uuidArray = (values: readonly string[]) => sql`${sql.param([...values])}::uuid[]`;
const normalize = (value: SQL | string) => sql`lower(unaccent(${value}))`;
/** Weighted vector of the `simple` configuration without accents (ADR 0066). */
const weighted = (text: string, weight: 'A' | 'B' | 'C' | 'D') =>
  sql`setweight(to_tsvector('simple', ${normalize(text)}), ${weight})`;

const notHidden = (hidden: readonly string[]) =>
  hidden.length > 0
    ? sql`(${documents.ownerId} is null or ${documents.ownerId} <> all(${uuidArray(hidden)}))`
    : undefined;

/** Open projects (in funding or funded): those a contributor may still support. */
const OPEN_PROJECT = sql`${documents.status} in ('funding', 'funded')`;

@Injectable()
export class DrizzleDiscoveryRepository extends DiscoveryRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async replaceDocuments(
    kind: DiscoveryKind,
    entityId: string,
    indexed: readonly IndexedDocument[],
    at: Date,
  ): Promise<void> {
    const audiences = indexed.map((document) => document.audience);
    await this.db
      .delete(documents)
      .where(
        and(
          eq(documents.kind, kind),
          eq(documents.entityId, entityId),
          audiences.length > 0
            ? sql`${documents.audience} <> all(${textArray(audiences)})`
            : undefined,
        ),
      );
    for (const document of indexed) {
      const values = {
        kind,
        entityId,
        audience: document.audience,
        key: document.key,
        ownerId: document.ownerId,
        name: document.name,
        nameNormalized: sql`${normalize(document.name)}`,
        subtitle: document.subtitle,
        document: sql`${weighted(document.name, 'A')} || ${weighted(document.subtitle ?? '', 'B')} || ${weighted(document.body, 'C')} || ${weighted(document.labels, 'D')}`,
        countryCodes: document.countryCodes,
        sectorCodes: document.sectorCodes,
        tags: document.tags,
        status: document.status,
        impactScore: document.impactScore,
        amountMinor: document.amountMinor,
        currency: document.currency,
        startsAt: document.startsAt,
        endsAt: document.endsAt,
        publishedAt: document.publishedAt,
        featuredAt: document.featuredAt,
        fingerprint: document.fingerprint,
        indexedAt: at,
      };
      const { kind: _kind, entityId: _entityId, audience: _audience, ...update } = values;
      await this.db
        .insert(documents)
        .values(values)
        .onConflictDoUpdate({
          target: [documents.kind, documents.entityId, documents.audience],
          set: update,
        });
    }
  }

  async deleteDocuments(kind: DiscoveryKind, entityId: string): Promise<boolean> {
    const rows = await this.db
      .delete(documents)
      .where(and(eq(documents.kind, kind), eq(documents.entityId, entityId)))
      .returning({ entityId: documents.entityId });
    return rows.length > 0;
  }

  async fingerprints(
    kind: DiscoveryKind,
    entityIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (entityIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        entityId: documents.entityId,
        fingerprint: sql<string>`string_agg(${documents.fingerprint}, ',' order by ${documents.audience})`,
      })
      .from(documents)
      .where(and(eq(documents.kind, kind), inArray(documents.entityId, [...entityIds])))
      .groupBy(documents.entityId);
    return new Map(rows.map((row) => [row.entityId, row.fingerprint]));
  }

  async indexedIdsAfter(
    kind: DiscoveryKind,
    after: string | null,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ entityId: documents.entityId })
      .from(documents)
      .where(and(eq(documents.kind, kind), after ? gt(documents.entityId, after) : undefined))
      .orderBy(asc(documents.entityId))
      .limit(limit);
    return rows.map((row) => row.entityId);
  }

  async documents(
    kind: DiscoveryKind,
    entityIds: readonly string[],
    audience: Audience,
  ): Promise<StoredDocument[]> {
    if (entityIds.length === 0) return [];
    const rows = await this.db
      .select(stored)
      .from(documents)
      .where(
        and(
          eq(documents.kind, kind),
          eq(documents.audience, audience),
          inArray(documents.entityId, [...entityIds]),
        ),
      );
    const byId = new Map(rows.map((row) => [row.entityId, toStored(row)]));
    return entityIds.flatMap((id) => {
      const document = byId.get(id);
      return document ? [document] : [];
    });
  }

  async documentByKey(
    kind: DiscoveryKind,
    key: string,
    audience: Audience,
  ): Promise<StoredDocument | null> {
    const [row] = await this.db
      .select(stored)
      .from(documents)
      .where(
        and(eq(documents.kind, kind), eq(documents.key, key), eq(documents.audience, audience)),
      );
    return row ? toStored(row) : null;
  }

  /**
   * Full text on the weighted vector, or a name close to the query despite typos (trigram
   * `<%`, word similarity at least NAME_SIMILARITY_THRESHOLD); score = text rank + similarity
   * of the name + bonus of a name starting with the query (ADR 0066).
   */
  async search(criteria: SearchCriteria): Promise<SearchHit[]> {
    const { normalized, tsQuery } = criteria;
    const query = tsQuery ? sql`to_tsquery('simple', ${tsQuery})` : null;
    const score =
      normalized && query
        ? sql<number>`(case when ${documents.document} @@ ${query} then ts_rank_cd(${RANK_WEIGHTS_ARRAY}::float4[], ${documents.document}, ${query}) else 0 end)
            + ${NAME_SIMILARITY_WEIGHT} * word_similarity(${normalized}, ${documents.nameNormalized})
            + (case when ${documents.nameNormalized} like ${`${likeEscape(normalized)}%`} then ${NAME_PREFIX_BONUS} else 0 end)`
        : sql<number>`0`;
    return this.transactions.run(async () => {
      if (normalized) {
        await this.db.execute(
          sql`select set_config('pg_trgm.word_similarity_threshold', ${String(NAME_SIMILARITY_THRESHOLD)}, true)`,
        );
      }
      const rows = await this.db
        .select({ ...stored, score })
        .from(documents)
        .where(
          and(
            eq(documents.audience, criteria.audience),
            inArray(documents.kind, [...criteria.kinds]),
            normalized && query
              ? sql`(${documents.document} @@ ${query} or ${normalized} <% ${documents.nameNormalized})`
              : undefined,
            ...this.filters(criteria),
            notHidden(criteria.hiddenOwnerIds),
          ),
        )
        .orderBy(
          ...(normalized ? [sql`${score} desc`] : []),
          sql`${documents.publishedAt} desc nulls last`,
          asc(documents.name),
          asc(documents.entityId),
        )
        .offset(criteria.offset)
        .limit(criteria.limit);
      return rows.map((row) => ({ ...toStored(row), score: Number(row.score) }));
    });
  }

  /** A kind-specific filter applies to its kind only; the others go through. */
  private filters(criteria: SearchCriteria): (SQL | undefined)[] {
    const only = (kind: DiscoveryKind, condition: SQL) =>
      sql`(${documents.kind} <> ${kind} or ${condition})`;
    const tag = (value: string) => sql`${documents.tags} @> ${textArray([value])}`;
    return [
      criteria.countryCode
        ? sql`${documents.countryCodes} @> ${textArray([criteria.countryCode])}`
        : undefined,
      criteria.sectorCode
        ? sql`${documents.sectorCodes} @> ${textArray([criteria.sectorCode])}`
        : undefined,
      criteria.language ? tag(`lang:${criteria.language}`) : undefined,
      criteria.projectStatus
        ? only('project', sql`${documents.status} = ${criteria.projectStatus}`)
        : undefined,
      criteria.minImpact !== undefined
        ? only('project', sql`${documents.impactScore} >= ${criteria.minImpact}`)
        : undefined,
      criteria.facet ? only('person', tag(`facet:${criteria.facet}`)) : undefined,
      criteria.hat ? only('person', tag(`hat:${criteria.hat}`)) : undefined,
      criteria.mentoring ? only('person', tag('mentoring')) : undefined,
      criteria.structureType
        ? only('organization', tag(`structure:${criteria.structureType}`))
        : undefined,
      criteria.verified ? only('organization', tag('verified')) : undefined,
      criteria.eventFormat ? only('event', tag(`format:${criteria.eventFormat}`)) : undefined,
      criteria.includePast ? undefined : only('event', sql`${documents.endsAt} > ${criteria.now}`),
      criteria.missionDirection
        ? only('mission', tag(`direction:${criteria.missionDirection}`))
        : undefined,
      criteria.missionKind ? only('mission', tag(`kind:${criteria.missionKind}`)) : undefined,
      criteria.missionMode ? only('mission', tag(`mode:${criteria.missionMode}`)) : undefined,
    ];
  }

  async autocomplete(criteria: {
    audience: Audience;
    normalized: string;
    kinds: readonly DiscoveryKind[];
    hiddenOwnerIds: readonly string[];
    limit: number;
  }): Promise<StoredDocument[]> {
    const prefix = `${likeEscape(criteria.normalized)}%`;
    const wordPrefix = `% ${likeEscape(criteria.normalized)}%`;
    return this.transactions.run(async () => {
      await this.db.execute(
        sql`select set_config('pg_trgm.word_similarity_threshold', ${String(NAME_SIMILARITY_THRESHOLD)}, true)`,
      );
      const rows = await this.db
        .select(stored)
        .from(documents)
        .where(
          and(
            eq(documents.audience, criteria.audience),
            inArray(documents.kind, [...criteria.kinds]),
            sql`(${documents.nameNormalized} like ${prefix} or ${documents.nameNormalized} like ${wordPrefix} or ${criteria.normalized} <% ${documents.nameNormalized})`,
            notHidden(criteria.hiddenOwnerIds),
            sql`(${documents.kind} <> 'event' or ${documents.endsAt} > now())`,
          ),
        )
        .orderBy(
          sql`(${documents.nameNormalized} like ${prefix}) desc`,
          sql`word_similarity(${criteria.normalized}, ${documents.nameNormalized}) desc`,
          asc(documents.name),
        )
        .limit(criteria.limit);
      return rows.map(toStored);
    });
  }

  async section(criteria: {
    audience: Audience;
    section:
      | 'recent_projects'
      | 'ending_soon_projects'
      | 'editorial'
      | 'upcoming_events'
      | 'open_missions';
    hiddenOwnerIds: readonly string[];
    now: Date;
    offset: number;
    limit: number;
  }): Promise<StoredDocument[]> {
    const base = [eq(documents.audience, criteria.audience), notHidden(criteria.hiddenOwnerIds)];
    const select = this.db.select(stored).from(documents);
    const query = (() => {
      switch (criteria.section) {
        case 'recent_projects':
          return select
            .where(and(...base, eq(documents.kind, 'project'), OPEN_PROJECT))
            .orderBy(sql`${documents.publishedAt} desc`, asc(documents.entityId));
        case 'ending_soon_projects':
          return select
            .where(
              and(
                ...base,
                eq(documents.kind, 'project'),
                OPEN_PROJECT,
                sql`${documents.endsAt} > ${criteria.now}`,
              ),
            )
            .orderBy(asc(documents.endsAt), asc(documents.entityId));
        case 'editorial':
          return select
            .where(
              and(...base, eq(documents.kind, 'project'), sql`${documents.featuredAt} is not null`),
            )
            .orderBy(sql`${documents.featuredAt} desc`, asc(documents.entityId));
        case 'upcoming_events':
          return select
            .where(
              and(
                ...base,
                eq(documents.kind, 'event'),
                eq(documents.status, 'published'),
                sql`${documents.endsAt} > ${criteria.now}`,
              ),
            )
            .orderBy(asc(documents.startsAt), asc(documents.entityId));
        case 'open_missions':
          return select
            .where(and(...base, eq(documents.kind, 'mission')))
            .orderBy(sql`${documents.publishedAt} desc`, asc(documents.entityId));
      }
    })();
    const rows = await query.offset(criteria.offset).limit(criteria.limit);
    return rows.map(toStored);
  }

  async upsertMatchProfile(profile: MatchProfileRecord, at: Date): Promise<void> {
    const { userId: _userId, ...update } = profile;
    await this.db
      .insert(profiles)
      .values({ ...profile, updatedAt: at })
      .onConflictDoUpdate({ target: profiles.userId, set: { ...update, updatedAt: at } });
  }

  async deleteMatchProfile(userId: string): Promise<void> {
    await this.db.delete(profiles).where(eq(profiles.userId, userId));
  }

  async matchProfiles(userIds: readonly string[]): Promise<MatchProfileRecord[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(profiles)
      .where(inArray(profiles.userId, [...userIds]));
    return rows.map(toProfile);
  }

  /**
   * Contributors for the entrepreneur side of the viewer, entrepreneurs for their contributor
   * side, by the GIN indexes of hats, needs, sectors and countries (ADR 0068).
   */
  async peopleCandidates(viewer: PersonProfile, cap: number): Promise<MatchProfileRecord[]> {
    const branches: SQL[] = [];
    const e = viewer.entrepreneur;
    if (e) {
      const hats = [...new Set(e.needs.flatMap((need) => NEED_TO_HATS[need]))];
      branches.push(
        sql`(${profiles.hasContributor} and ${profiles.contributorVisibility} <> 'private' and (
          ${profiles.hats} && ${textArray(hats)}
          or ${profiles.contributorSectors} && ${textArray([e.sector])}
          or ${profiles.interventionCountries} && ${textArray([e.companyCountry])}
          or (${e.needs.includes('mentoring')} and ${profiles.mentoringAvailable})))`,
      );
    }
    const c = viewer.contributor;
    if (c) {
      const needs = Object.entries(NEED_TO_HATS)
        .filter(([, hats]) => hats.some((hat) => c.hats.includes(hat)))
        .map(([need]) => need);
      branches.push(
        sql`(${profiles.hasEntrepreneur} and ${profiles.entrepreneurVisibility} <> 'private' and (
          ${profiles.needs} && ${textArray(needs)}
          or ${profiles.entrepreneurSector} = any(${textArray(c.sectors)})
          or ${profiles.companyCountry} = any(${textArray(c.interventionCountries)})
          or (${c.mentoringAvailable} and ${profiles.needs} @> ${textArray(['mentoring'])})))`,
      );
    }
    if (branches.length === 0) return [];
    return this.candidates(
      and(sql`${profiles.userId} <> ${viewer.userId}`, sql`(${sql.join(branches, sql` or `)})`),
      cap,
    );
  }

  async complementaryCandidates(viewer: PersonProfile, cap: number): Promise<MatchProfileRecord[]> {
    const e = viewer.entrepreneur;
    if (!e) return [];
    return this.candidates(
      and(
        sql`${profiles.userId} <> ${viewer.userId}`,
        eq(profiles.hasEntrepreneur, true),
        sql`${profiles.entrepreneurVisibility} <> 'private'`,
        sql`((${profiles.companyCountry} = ${e.companyCountry} and ${profiles.entrepreneurSector} <> ${e.sector})
          or (${profiles.entrepreneurSector} = ${e.sector} and ${profiles.companyCountry} <> ${e.companyCountry}))`,
      ),
      cap,
    );
  }

  async contributorCandidates(project: ProjectProfile, cap: number): Promise<MatchProfileRecord[]> {
    return this.candidates(
      and(
        eq(profiles.hasContributor, true),
        sql`${profiles.contributorVisibility} <> 'private'`,
        project.ownerId ? sql`${profiles.userId} <> ${project.ownerId}` : undefined,
        sql`(${profiles.contributorSectors} && ${textArray(project.sector ? [project.sector] : [])}
          or ${profiles.interventionCountries} && ${textArray(project.countries)}
          or ${profiles.instruments} && ${textArray(project.instruments)})`,
      ),
      cap,
    );
  }

  async membersForMission(mission: MissionProfile, cap: number): Promise<MatchProfileRecord[]> {
    const offer = mission.direction === 'offer';
    const need = mission.kind === 'mentoring' ? 'mentoring' : 'expertise';
    const hat = mission.kind === 'mentoring' ? 'mentor' : 'expert';
    return this.candidates(
      and(
        mission.authorId ? sql`${profiles.userId} <> ${mission.authorId}` : undefined,
        offer
          ? sql`(${profiles.hasEntrepreneur} and ${profiles.needs} @> ${textArray([need])})`
          : sql`(${profiles.hasContributor} and ${profiles.hats} @> ${textArray([hat])})`,
      ),
      cap,
    );
  }

  async membersForEvent(event: EventProfile, cap: number): Promise<MatchProfileRecord[]> {
    return this.candidates(
      and(
        event.organizerId ? sql`${profiles.userId} <> ${event.organizerId}` : undefined,
        sql`(${profiles.contributorSectors} && ${textArray(event.sectors)}
          or ${profiles.entrepreneurSector} = any(${textArray(event.sectors)})
          or ${profiles.interventionCountries} && ${textArray(event.countries)}
          or ${profiles.companyCountry} = any(${textArray(event.countries)})
          or ${profiles.residenceCountry} = any(${textArray(event.countries)}))`,
      ),
      cap,
    );
  }

  private async candidates(where: SQL | undefined, cap: number): Promise<MatchProfileRecord[]> {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(where)
      .orderBy(sql`${profiles.updatedAt} desc`, asc(profiles.userId))
      .limit(cap);
    return rows.map(toProfile);
  }

  async projectCandidates(viewer: PersonProfile, cap: number): Promise<StoredDocument[]> {
    const c = viewer.contributor;
    if (!c) return [];
    return this.documentCandidates(
      and(
        eq(documents.kind, 'project'),
        OPEN_PROJECT,
        sql`(${documents.ownerId} is null or ${documents.ownerId} <> ${viewer.userId})`,
        sql`(${documents.sectorCodes} && ${textArray(c.sectors)}
          or ${documents.countryCodes} && ${textArray(c.interventionCountries)}
          or ${documents.tags} && ${textArray(c.instruments.map((instrument) => `instrument:${instrument}`))})`,
      ),
      cap,
    );
  }

  async missionCandidates(viewer: PersonProfile, cap: number): Promise<StoredDocument[]> {
    const wanted: string[] = [];
    for (const need of viewer.entrepreneur?.needs ?? []) {
      if (need === 'mentoring' || need === 'expertise') {
        wanted.push(`offer:${need === 'mentoring' ? 'mentoring' : 'expertise'}`);
      }
    }
    for (const hat of viewer.contributor?.hats ?? []) {
      if (hat === 'mentor') wanted.push('request:mentoring');
      if (hat === 'expert') wanted.push('request:expertise');
    }
    if (wanted.length === 0) return [];
    const branches = wanted.map((pair) => {
      const [direction, kind] = pair.split(':') as [string, string];
      return sql`${documents.tags} @> ${textArray([`direction:${direction}`, `kind:${kind}`])}`;
    });
    return this.documentCandidates(
      and(
        eq(documents.kind, 'mission'),
        sql`(${documents.ownerId} is null or ${documents.ownerId} <> ${viewer.userId})`,
        sql`(${sql.join(branches, sql` or `)})`,
      ),
      cap,
    );
  }

  async eventCandidates(viewer: PersonProfile, now: Date, cap: number): Promise<StoredDocument[]> {
    const sectors = [
      ...(viewer.entrepreneur ? [viewer.entrepreneur.sector] : []),
      ...(viewer.contributor?.sectors ?? []),
    ];
    const countries = [
      ...(viewer.residenceCountry ? [viewer.residenceCountry] : []),
      ...(viewer.entrepreneur ? [viewer.entrepreneur.companyCountry] : []),
      ...(viewer.contributor?.interventionCountries ?? []),
    ];
    if (sectors.length === 0 && countries.length === 0) return [];
    return this.documentCandidates(
      and(
        eq(documents.kind, 'event'),
        eq(documents.status, 'published'),
        sql`${documents.startsAt} > ${now}`,
        sql`(${documents.ownerId} is null or ${documents.ownerId} <> ${viewer.userId})`,
        sql`(${documents.sectorCodes} && ${textArray(sectors)} or ${documents.countryCodes} && ${textArray(countries)})`,
      ),
      cap,
    );
  }

  private async documentCandidates(where: SQL | undefined, cap: number): Promise<StoredDocument[]> {
    const rows = await this.db
      .select(stored)
      .from(documents)
      .where(and(eq(documents.audience, 'members'), where))
      .orderBy(sql`${documents.publishedAt} desc nulls last`, asc(documents.entityId))
      .limit(cap);
    return rows.map(toStored);
  }

  async replaceSuggestions(
    subject: SubjectRef,
    list: ListName,
    rows: readonly SuggestionRow[],
    at: Date,
  ): Promise<void> {
    const kept = rows.map((row) => `${row.candidateKind}:${row.candidateId}`);
    await this.db
      .delete(suggestions)
      .where(
        and(
          this.ofList(subject, list),
          kept.length > 0
            ? sql`(${suggestions.candidateKind} || ':' || ${suggestions.candidateId}) <> all(${textArray(kept)})`
            : undefined,
        ),
      );
    for (const row of rows) await this.upsertSuggestion(subject, list, row, at);
  }

  async upsertSuggestion(
    subject: SubjectRef,
    list: ListName,
    row: SuggestionRow,
    at: Date,
  ): Promise<void> {
    await this.db
      .insert(suggestions)
      .values({
        subjectType: subject.type,
        subjectId: subject.id,
        list,
        candidateKind: row.candidateKind,
        candidateId: row.candidateId,
        score: row.score,
        reasons: row.reasons,
        rulesVersion: row.rulesVersion,
        firstSuggestedAt: at,
        computedAt: at,
      })
      .onConflictDoUpdate({
        target: [
          suggestions.subjectType,
          suggestions.subjectId,
          suggestions.list,
          suggestions.candidateKind,
          suggestions.candidateId,
        ],
        set: {
          score: row.score,
          reasons: row.reasons,
          rulesVersion: row.rulesVersion,
          computedAt: at,
        },
      });
  }

  async deleteSuggestion(
    subject: SubjectRef,
    list: ListName,
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<void> {
    await this.db
      .delete(suggestions)
      .where(
        and(
          this.ofList(subject, list),
          eq(suggestions.candidateKind, candidateKind),
          eq(suggestions.candidateId, candidateId),
        ),
      );
  }

  async trimSuggestions(subject: SubjectRef, list: ListName, keep: number): Promise<void> {
    await this.db.execute(sql`
      delete from ${suggestions}
      where ${this.ofList(subject, list)}
        and (${suggestions.candidateKind}, ${suggestions.candidateId}) not in (
          select ${suggestions.candidateKind}, ${suggestions.candidateId} from ${suggestions}
          where ${this.ofList(subject, list)}
          order by ${suggestions.score} desc, ${suggestions.candidateId}
          limit ${keep}
        )`);
  }

  async deleteSubjectSuggestions(subject: SubjectRef): Promise<void> {
    await this.db
      .delete(suggestions)
      .where(and(eq(suggestions.subjectType, subject.type), eq(suggestions.subjectId, subject.id)));
  }

  async subjectsWithCandidate(
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<{ subject: SubjectRef; list: ListName }[]> {
    const rows = await this.db
      .select({
        subjectType: suggestions.subjectType,
        subjectId: suggestions.subjectId,
        list: suggestions.list,
      })
      .from(suggestions)
      .where(
        and(eq(suggestions.candidateKind, candidateKind), eq(suggestions.candidateId, candidateId)),
      );
    return rows.map((row) => ({
      subject: { type: row.subjectType as SubjectRef['type'], id: row.subjectId },
      list: row.list as ListName,
    }));
  }

  async removeCandidate(candidateKind: DiscoveryKind, candidateId: string): Promise<void> {
    await this.db
      .delete(suggestions)
      .where(
        and(eq(suggestions.candidateKind, candidateKind), eq(suggestions.candidateId, candidateId)),
      );
  }

  async suggestions(
    subject: SubjectRef,
    list: ListName,
    options: {
      dismissedBy: string | null;
      excludedIds: readonly string[];
      offset: number;
      limit: number;
    },
  ): Promise<(SuggestionRow & { firstSuggestedAt: Date })[]> {
    const rows = await this.db
      .select({
        candidateKind: suggestions.candidateKind,
        candidateId: suggestions.candidateId,
        score: suggestions.score,
        reasons: suggestions.reasons,
        rulesVersion: suggestions.rulesVersion,
        firstSuggestedAt: suggestions.firstSuggestedAt,
      })
      .from(suggestions)
      .where(
        and(
          this.ofList(subject, list),
          options.excludedIds.length > 0
            ? sql`${suggestions.candidateId} <> all(${uuidArray(options.excludedIds)})`
            : undefined,
          options.dismissedBy
            ? sql`not exists (select 1 from ${dismissals} where ${dismissals.userId} = ${options.dismissedBy}
                and ${dismissals.candidateKind} = ${suggestions.candidateKind}
                and ${dismissals.candidateId} = ${suggestions.candidateId})`
            : undefined,
          // The candidate is still indexed for members (not deleted, moderated or a draft).
          sql`exists (select 1 from ${documents} where ${documents.kind} = ${suggestions.candidateKind}
            and ${documents.entityId} = ${suggestions.candidateId} and ${documents.audience} = 'members')`,
        ),
      )
      .orderBy(sql`${suggestions.score} desc`, asc(suggestions.candidateId))
      .offset(options.offset)
      .limit(options.limit);
    return rows.map((row) => ({
      ...row,
      candidateKind: row.candidateKind as DiscoveryKind,
      reasons: row.reasons as SuggestionReason[],
    }));
  }

  async addDismissal(
    userId: string,
    candidateKind: DiscoveryKind,
    candidateId: string,
    at: Date,
  ): Promise<boolean> {
    const rows = await this.db
      .insert(dismissals)
      .values({ userId, candidateKind, candidateId, dismissedAt: at })
      .onConflictDoNothing()
      .returning({ userId: dismissals.userId });
    return rows.length > 0;
  }

  async removeDismissal(
    userId: string,
    candidateKind: DiscoveryKind,
    candidateId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(dismissals)
      .where(
        and(
          eq(dismissals.userId, userId),
          eq(dismissals.candidateKind, candidateKind),
          eq(dismissals.candidateId, candidateId),
        ),
      )
      .returning({ userId: dismissals.userId });
    return rows.length > 0;
  }

  async newSuggestionCounts(from: Date, to: Date): Promise<{ userId: string; count: number }[]> {
    const rows = await this.db
      .select({ userId: suggestions.subjectId, count: sql<number>`count(*)::int` })
      .from(suggestions)
      .where(
        and(
          eq(suggestions.subjectType, 'member'),
          sql`${suggestions.firstSuggestedAt} >= ${from}`,
          sql`${suggestions.firstSuggestedAt} < ${to}`,
        ),
      )
      .groupBy(suggestions.subjectId)
      .orderBy(asc(suggestions.subjectId));
    return rows;
  }

  private ofList(subject: SubjectRef, list: ListName): SQL {
    return and(
      eq(suggestions.subjectType, subject.type),
      eq(suggestions.subjectId, subject.id),
      eq(suggestions.list, list),
    )!;
  }
}

/** Escapes the LIKE wildcards of a user query. */
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
