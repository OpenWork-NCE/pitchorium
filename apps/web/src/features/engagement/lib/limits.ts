/**
 * Limits of the engagement contracts, copied for the components (limits.spec.ts keeps them
 * equal): a constant of `@pitchorium/contracts` would bring Zod into the chunk (ADR 0094).
 */
export const TIME_LIMITS = { description: 1000, maxMinutes: 24 * 60 } as const;
