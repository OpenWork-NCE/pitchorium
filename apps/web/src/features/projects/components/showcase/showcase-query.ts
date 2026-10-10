import type { ProjectsControllerShowcaseParams } from '@pitchorium/api-client';

export const SHOWCASE_STATUSES = ['funding', 'funded', 'closed'] as const;
export const SHOWCASE_IMPACTS = ['40', '70'] as const;
export const SHOWCASE_SORTS = ['recent', 'ending_soon'] as const;
export const SHOWCASE_PAGE_SIZE = 12;

/** Filters of the showcase (§10.6), as they stand in the address. */
export interface ShowcaseFilters {
  country: string | null;
  sector: string | null;
  status: (typeof SHOWCASE_STATUSES)[number] | null;
  impact: (typeof SHOWCASE_IMPACTS)[number] | null;
  sort: (typeof SHOWCASE_SORTS)[number];
}

const pick = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;

const code = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/** The filters of an address, an unknown value left out (the api would refuse it). */
export function readShowcaseFilters(params: Record<string, string | string[] | undefined>) {
  return {
    country: code(params.country, /^[A-Z]{2}$/),
    sector: code(params.sector, /^[a-z0-9_]{1,48}$/),
    status: pick(SHOWCASE_STATUSES, params.status),
    impact: pick(SHOWCASE_IMPACTS, params.impact),
    sort: pick(SHOWCASE_SORTS, params.sort) ?? 'recent',
  } satisfies ShowcaseFilters;
}

/** True when a filter narrows the showcase (the sort does not). */
export function isFiltered(filters: ShowcaseFilters): boolean {
  return Boolean(filters.country || filters.sector || filters.status || filters.impact);
}

/** The query of the api for these filters (the impact filter only with a methodology). */
export function showcaseQuery(
  filters: ShowcaseFilters,
  options: { impactAvailable: boolean; cursor?: string },
): ProjectsControllerShowcaseParams {
  return {
    limit: SHOWCASE_PAGE_SIZE,
    sort: filters.sort,
    ...(filters.country ? { countryCode: filters.country } : {}),
    ...(filters.sector ? { sectorCode: filters.sector } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.impact && options.impactAvailable ? { minImpact: Number(filters.impact) } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
  };
}
