/**
 * Limits and values of the contracts the mission pages read, copied so that no constant of the
 * contracts brings Zod into a first load (AGENTS.md); `limits.spec.ts` keeps them equal.
 */
export const MISSION_TITLE_MAX_LENGTH = 120;
export const MISSION_DESCRIPTION_MAX_LENGTH = 5_000;
export const MISSION_DOMAIN_MAX_LENGTH = 80;
export const MISSION_MESSAGE_MAX_LENGTH = 2_000;
export const MISSION_SKILLS_MAX = 10;
export const MISSION_SECTORS_MAX = 5;
export const MISSION_COUNTRIES_MAX = 10;
export const MISSION_LANGUAGES_MAX = 5;
export const MISSION_CAPACITY_MAX = 20;
export const MISSION_MAX_HOURS = { session: 8, short_mission: 80 } as const;
export const MISSION_DIRECTIONS = ['offer', 'request'] as const;
export const MISSION_FORMATS = ['session', 'short_mission'] as const;
export const MISSION_MODES = ['remote', 'on_site'] as const;
export const MISSION_KINDS = ['mentoring', 'expertise'] as const;
export type MissionDirection = (typeof MISSION_DIRECTIONS)[number];
