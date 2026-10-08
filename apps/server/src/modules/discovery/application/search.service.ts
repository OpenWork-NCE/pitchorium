import { Injectable } from '@nestjs/common';
import {
  type AutocompleteItem,
  type AutocompleteQuery,
  type CursorPage,
  DISCOVERY_KINDS,
  type DiscoveryCard,
  type DiscoveryKind,
  type SearchQuery,
} from '@pitchorium/contracts';
import { Clock, decodeCursor, DomainError, encodeCursor } from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import type { Audience } from '../domain/search-documents';
import { normalizeQuery, prefixTsQuery } from '../domain/search-query';
import { CardsService } from './cards.service';
import { DiscoveryRepository } from './ports';

/** Results reachable by paging (offset cursor); beyond, the query must be refined. */
export const SEARCH_MAX_OFFSET = 1000;

/** Who searches: a signed-in member (members audience) or a visitor (public audience). */
export type Searcher = { kind: 'member'; viewerId: string } | { kind: 'public' };

/** Kinds a kind-specific filter restricts the search to (projects only for `projectStatus`). */
function kindsOf(query: SearchQuery): DiscoveryKind[] {
  const requested = query.kinds ?? [...DISCOVERY_KINDS];
  const implied = new Set<DiscoveryKind>();
  if (query.projectStatus !== undefined || query.minImpact !== undefined) implied.add('project');
  if (query.facet || query.hat || query.mentoring !== undefined) implied.add('person');
  if (query.structureType || query.verified !== undefined) implied.add('organization');
  if (query.eventFormat || query.includePast !== undefined) implied.add('event');
  if (query.missionDirection || query.missionKind || query.missionMode) implied.add('mission');
  return implied.size === 0 ? requested : requested.filter((kind) => implied.has(kind));
}

export function offsetOf(cursor: string | undefined): number {
  if (!cursor) return 0;
  const offset = Number(decodeCursor(cursor)['offset']);
  if (!Number.isInteger(offset) || offset < 0 || offset > SEARCH_MAX_OFFSET) {
    throw new DomainError('BAD_REQUEST', 'Invalid pagination cursor');
  }
  return offset;
}

export function nextOffsetCursor(offset: number, limit: number, fetched: number): string | null {
  return fetched > limit && offset + limit <= SEARCH_MAX_OFFSET
    ? encodeCursor({ offset: String(offset + limit) })
    : null;
}

/**
 * Global search (§10.6, ADR 0066): one bar for people, organizations, projects, events and
 * missions; full text of the `simple` configuration without accents, typo tolerance on the
 * names by trigrams, filters, visibility of the reader (public documents without session,
 * members documents otherwise, nothing across a block).
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly cards: CardsService,
    private readonly network: NetworkFacade,
    private readonly clock: Clock,
  ) {}

  async search(query: SearchQuery, searcher: Searcher): Promise<CursorPage<DiscoveryCard>> {
    const kinds = kindsOf(query);
    if (kinds.length === 0) return { items: [], nextCursor: null };
    const normalized = query.q ? normalizeQuery(query.q) : '';
    const offset = offsetOf(query.cursor);
    const hits = await this.discovery.search({
      audience: audienceOf(searcher),
      kinds,
      normalized: normalized === '' ? null : normalized,
      tsQuery: prefixTsQuery(normalized),
      countryCode: query.countryCode,
      sectorCode: query.sectorCode,
      language: query.language,
      projectStatus: query.projectStatus,
      minImpact: query.minImpact,
      facet: query.facet,
      hat: query.hat,
      mentoring: query.mentoring,
      structureType: query.structureType,
      verified: query.verified,
      eventFormat: query.eventFormat,
      includePast: query.includePast ?? false,
      missionDirection: query.missionDirection,
      missionKind: query.missionKind,
      missionMode: query.missionMode,
      hiddenOwnerIds: await this.hidden(searcher),
      now: this.clock.now(),
      offset,
      limit: query.limit + 1,
    });
    return {
      items: await this.cards.cards(hits.slice(0, query.limit), viewerOf(searcher)),
      nextCursor: nextOffsetCursor(offset, query.limit, hits.length),
    };
  }

  /** Names starting with the query first, then names close to it despite typos. */
  async autocomplete(
    query: AutocompleteQuery,
    searcher: Searcher,
  ): Promise<{ items: AutocompleteItem[] }> {
    const normalized = normalizeQuery(query.q);
    if (normalized === '') return { items: [] };
    const documents = await this.discovery.autocomplete({
      audience: audienceOf(searcher),
      normalized,
      kinds: query.kinds ?? [...DISCOVERY_KINDS],
      hiddenOwnerIds: await this.hidden(searcher),
      limit: query.limit,
    });
    return {
      items: documents.map((document) => ({
        kind: document.kind,
        key: document.key,
        title: document.name,
        subtitle: document.subtitle,
      })),
    };
  }

  private async hidden(searcher: Searcher): Promise<string[]> {
    return searcher.kind === 'member' ? this.network.blockedUserIds(searcher.viewerId) : [];
  }
}

export function audienceOf(searcher: Searcher): Audience {
  return searcher.kind === 'member' ? 'members' : 'public';
}

export function viewerOf(searcher: Searcher): string | null {
  return searcher.kind === 'member' ? searcher.viewerId : null;
}
