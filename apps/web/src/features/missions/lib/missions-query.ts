import type {
  MissionsControllerListParams,
  MissionsControllerMyEngagementsParams,
} from '@pitchorium/api-client';
import { MISSION_DIRECTIONS, MISSION_KINDS, MISSION_MODES } from './limits';

/** Views of the list: every open mission, the member's own, their engagements. */
export const MISSION_TABS = ['all', 'mine', 'engagements'] as const;
export type MissionTab = (typeof MISSION_TABS)[number];
export const ENGAGEMENT_ROLES = ['expert', 'beneficiary'] as const;
export const MISSIONS_PAGE_SIZE = 12;

export interface MissionFilters {
  tab: MissionTab;
  direction: (typeof MISSION_DIRECTIONS)[number] | null;
  kind: (typeof MISSION_KINDS)[number] | null;
  mode: (typeof MISSION_MODES)[number] | null;
  sector: string | null;
  country: string | null;
  language: string | null;
  role: (typeof ENGAGEMENT_ROLES)[number] | null;
}

const pick = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;

const code = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/** The filters of an address; « Mes missions » and « Mes engagements » for a member only. */
export function readMissionFilters(
  params: Record<string, string | string[] | undefined>,
  signedIn: boolean,
): MissionFilters {
  const tab = pick(MISSION_TABS, params.tab) ?? 'all';
  return {
    tab: tab !== 'all' && !signedIn ? 'all' : tab,
    direction: pick(MISSION_DIRECTIONS, params.direction),
    kind: pick(MISSION_KINDS, params.kind),
    mode: pick(MISSION_MODES, params.mode),
    sector: code(params.sector, /^[a-z0-9_]{1,48}$/),
    country: code(params.country, /^[A-Z]{2}$/),
    language: code(params.language, /^[a-z]{2}$/),
    role: pick(ENGAGEMENT_ROLES, params.role),
  };
}

export function isFiltered(filters: MissionFilters): boolean {
  return Boolean(
    filters.direction ||
    filters.kind ||
    filters.mode ||
    filters.sector ||
    filters.country ||
    filters.language,
  );
}

export function missionsApiQuery(
  filters: MissionFilters,
  cursor?: string,
): MissionsControllerListParams {
  return {
    limit: MISSIONS_PAGE_SIZE,
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.mode ? { mode: filters.mode } : {}),
    ...(filters.sector ? { sectorCode: filters.sector } : {}),
    ...(filters.country ? { countryCode: filters.country } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

export function myEngagementsQuery(
  filters: MissionFilters,
  cursor?: string,
): MissionsControllerMyEngagementsParams {
  return {
    limit: MISSIONS_PAGE_SIZE,
    ...(filters.role ? { role: filters.role } : {}),
    ...(cursor ? { cursor } : {}),
  };
}
