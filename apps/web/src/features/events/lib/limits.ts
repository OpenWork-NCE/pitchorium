/**
 * Limits and values of the contracts the event pages read, copied so that no constant of the
 * contracts brings Zod into a first load (AGENTS.md); `limits.spec.ts` keeps them equal.
 */
export const EVENT_TITLE_MAX_LENGTH = 120;
export const EVENT_DESCRIPTION_MAX_LENGTH = 10_000;
export const EVENT_LOCATION_MAX_LENGTH = 200;
export const EVENT_IMAGE_ALT_MAX_LENGTH = 300;
export const EVENT_SECTORS_MAX = 5;
export const EVENT_CAPACITY_MAX = 100_000;
export const EVENT_FORMATS = ['online', 'in_person', 'hybrid'] as const;
