/**
 * Limits of the reports and the appeals, written here as the contracts set them so that the
 * pages never load Zod with the contracts (ADR 0094); limits.spec.ts keeps them equal.
 */
export const TRUST_LIMITS = {
  reportDetails: 2000,
  appealStatement: 5000,
} as const;
