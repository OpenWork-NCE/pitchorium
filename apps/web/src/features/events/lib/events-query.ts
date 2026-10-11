import type {
  EventsControllerListParams,
  EventsControllerMineParams,
} from '@pitchorium/api-client';
import { EVENT_FORMATS } from './limits';

/** Views of the list: upcoming, past, and the member's own (registered or organized). */
export const EVENT_TABS = ['upcoming', 'past', 'mine'] as const;
export type EventTab = (typeof EVENT_TABS)[number];
export const MY_ROLES = ['attendee', 'organizer'] as const;
export const EVENTS_PAGE_SIZE = 12;

export interface EventFilters {
  tab: EventTab;
  role: (typeof MY_ROLES)[number];
  format: (typeof EVENT_FORMATS)[number] | null;
  country: string | null;
  sector: string | null;
  language: string | null;
  /** `YYYY-MM-DD`: upcoming events still running from that day on. */
  from: string | null;
}

const pick = <T extends string>(values: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : null;

const code = (value: unknown, pattern: RegExp): string | null =>
  typeof value === 'string' && pattern.test(value) ? value : null;

/** The filters of an address; « Mes événements » for a member only. */
export function readEventFilters(
  params: Record<string, string | string[] | undefined>,
  signedIn: boolean,
): EventFilters {
  const tab = pick(EVENT_TABS, params.tab) ?? 'upcoming';
  return {
    tab: tab === 'mine' && !signedIn ? 'upcoming' : tab,
    role: pick(MY_ROLES, params.role) ?? 'attendee',
    format: pick(EVENT_FORMATS, params.format),
    country: code(params.country, /^[A-Z]{2}$/),
    sector: code(params.sector, /^[a-z0-9_]{1,48}$/),
    language: code(params.language, /^[a-z]{2}$/),
    from: tab === 'upcoming' ? code(params.from, /^\d{4}-\d{2}-\d{2}$/) : null,
  };
}

export function isFiltered(filters: EventFilters): boolean {
  return Boolean(
    filters.format || filters.country || filters.sector || filters.language || filters.from,
  );
}

/** The query of the public or member list for these filters (the past ones the latest first). */
export function eventsApiQuery(filters: EventFilters, cursor?: string): EventsControllerListParams {
  return {
    limit: EVENTS_PAGE_SIZE,
    period: filters.tab === 'past' ? 'past' : 'upcoming',
    ...(filters.format ? { format: filters.format } : {}),
    ...(filters.country ? { countryCode: filters.country } : {}),
    ...(filters.sector ? { sectorCode: filters.sector } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    ...(filters.from ? { from: `${filters.from}T00:00:00Z` } : {}),
    ...(cursor ? { cursor } : {}),
  };
}

/** The query of « Mes événements ». */
export function myEventsQuery(filters: EventFilters, cursor?: string): EventsControllerMineParams {
  return { limit: EVENTS_PAGE_SIZE, role: filters.role, ...(cursor ? { cursor } : {}) };
}
