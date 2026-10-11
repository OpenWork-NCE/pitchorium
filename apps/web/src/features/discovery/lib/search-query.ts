import type { DiscoveryControllerSearchAsMemberParams } from '@pitchorium/api-client';
import {
  DISCOVERY_KINDS,
  type DiscoveryKind,
  EVENT_FORMATS,
  MISSION_DIRECTIONS,
  MISSION_KINDS,
  MISSION_MODES,
  PROJECT_STATUSES,
} from './kinds';

/** Tabs of the results page: every kind together, then one kind each. */
export const SEARCH_TABS = ['all', ...DISCOVERY_KINDS] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];
export const SEARCH_PAGE_SIZE = 20;
export const SEARCH_IMPACTS = ['40', '70'] as const;
export const SEARCH_WHEN = ['upcoming', 'all'] as const;

/** The query, the tab and the filters of the results page, as they stand in the address. */
export interface SearchFilters {
  q: string;
  type: SearchTab;
  country: string | null;
  sector: string | null;
  language: string | null;
  /** Projects (§10.6). */
  status: (typeof PROJECT_STATUSES)[number] | null;
  impact: (typeof SEARCH_IMPACTS)[number] | null;
  /** Events: format, and past ones too. */
  format: (typeof EVENT_FORMATS)[number] | null;
  when: (typeof SEARCH_WHEN)[number];
  /** Missions: offer or request, mentoring or expertise, remote or on site. */
  direction: (typeof MISSION_DIRECTIONS)[number] | null;
  kind: (typeof MISSION_KINDS)[number] | null;
  mode: (typeof MISSION_MODES)[number] | null;
}

/** The filters each tab offers: a filter of a kind restricts the api to it (ADR 0066). */
export const TAB_FILTERS: Record<SearchTab, readonly (keyof SearchFilters)[]> = {
  all: ['country', 'sector', 'language'],
  person: ['country', 'sector', 'language'],
  organization: ['country', 'sector'],
  project: ['country', 'sector', 'status', 'impact'],
  event: ['country', 'sector', 'language', 'format', 'when'],
  mission: ['country', 'sector', 'language', 'direction', 'kind', 'mode'],
};

const pick = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;

const code = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/** The query and filters of an address; an unknown value is left out (the api would refuse it). */
export function readSearchFilters(
  params: Record<string, string | string[] | undefined>,
): SearchFilters {
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const type = pick(SEARCH_TABS, params.type) ?? 'all';
  const filters: SearchFilters = {
    q,
    type,
    country: code(params.country, /^[A-Z]{2}$/),
    sector: code(params.sector, /^[a-z0-9_]{1,48}$/),
    language: code(params.language, /^[a-z]{2}$/),
    status: pick(PROJECT_STATUSES, params.status),
    impact: pick(SEARCH_IMPACTS, params.impact),
    format: pick(EVENT_FORMATS, params.format),
    when: pick(SEARCH_WHEN, params.when) ?? 'upcoming',
    direction: pick(MISSION_DIRECTIONS, params.direction),
    kind: pick(MISSION_KINDS, params.kind),
    mode: pick(MISSION_MODES, params.mode),
  };
  // A filter that the tab does not offer is dropped: the address stays honest.
  for (const key of ['status', 'impact', 'format', 'direction', 'kind', 'mode'] as const) {
    if (!TAB_FILTERS[type].includes(key)) filters[key] = null;
  }
  if (!TAB_FILTERS[type].includes('when')) filters.when = 'upcoming';
  return filters;
}

/** True when a filter narrows the results (the query and the tab do not count). */
export function isFiltered(filters: SearchFilters): boolean {
  return Boolean(
    filters.country ||
    filters.sector ||
    filters.language ||
    filters.status ||
    filters.impact ||
    filters.format ||
    filters.when === 'all' ||
    filters.direction ||
    filters.kind ||
    filters.mode,
  );
}

/** The query of the api for these filters, page by page (cursor). */
export function searchApiQuery(
  filters: SearchFilters,
  options: { impactAvailable: boolean; cursor?: string } = { impactAvailable: true },
): DiscoveryControllerSearchAsMemberParams {
  return {
    limit: SEARCH_PAGE_SIZE,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.type === 'all' ? {} : { kinds: filters.type }),
    ...(filters.country ? { countryCode: filters.country } : {}),
    ...(filters.sector ? { sectorCode: filters.sector } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.status ? { projectStatus: filters.status } : {}),
    ...(filters.impact && options.impactAvailable ? { minImpact: Number(filters.impact) } : {}),
    ...(filters.format ? { eventFormat: filters.format } : {}),
    ...(filters.type === 'event' && filters.when === 'all' ? { includePast: 'true' as const } : {}),
    ...(filters.direction ? { missionDirection: filters.direction } : {}),
    ...(filters.kind ? { missionKind: filters.kind } : {}),
    ...(filters.mode ? { missionMode: filters.mode } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}

/**
 * A broader query to propose when nothing matches: without the filters first, then the first
 * word only, then every kind. Null when the search is already as broad as it gets.
 */
export function broaderSearch(filters: SearchFilters): Record<string, string> | null {
  const q: Record<string, string> = filters.q ? { q: filters.q } : {};
  if (isFiltered(filters))
    return { ...q, ...(filters.type === 'all' ? {} : { type: filters.type }) };
  const words = filters.q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return {
      q: words.reduce((longest, word) => (word.length > longest.length ? word : longest)),
      ...(filters.type === 'all' ? {} : { type: filters.type }),
    };
  }
  if (filters.type !== 'all') return q;
  return null;
}

/** The address of the results page for a query, its tab and filters. */
export function searchHref(path: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
}

export type { DiscoveryKind };
