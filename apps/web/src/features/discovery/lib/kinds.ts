/**
 * Values of the contracts the pages of the discovery read, copied so that no constant of the
 * contracts brings Zod into a first load (AGENTS.md); `kinds.spec.ts` keeps them equal.
 */
export const DISCOVERY_KINDS = ['person', 'organization', 'project', 'event', 'mission'] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export const PROJECT_STATUSES = ['funding', 'funded', 'closed'] as const;
export const EVENT_FORMATS = ['online', 'in_person', 'hybrid'] as const;
export const MISSION_DIRECTIONS = ['offer', 'request'] as const;
export const MISSION_KINDS = ['mentoring', 'expertise'] as const;
export const MISSION_MODES = ['remote', 'on_site'] as const;

export const DISCOVER_SECTIONS = [
  'recent_projects',
  'ending_soon_projects',
  'suggested_profiles',
  'editorial',
  'upcoming_events',
  'open_missions',
] as const;
export type DiscoverSection = (typeof DISCOVER_SECTIONS)[number];
