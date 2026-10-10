/**
 * Limits of the payments contracts, copied for the components (limits.spec.ts keeps them equal):
 * a constant of `@pitchorium/contracts` would bring Zod into the chunk that reads it (ADR 0094).
 */
export const PAYMENT_LIMITS = {
  offlineDescription: 1000,
  offlineProofs: 5,
  kycDocuments: 10,
  decisionReason: 1000,
  timeEntryDescription: 1000,
  timeEntryMaxMinutes: 24 * 60,
} as const;

/** Currencies of an off-platform amount: the euro and the CFA francs at their fixed parity. */
export const OFFLINE_CURRENCIES = ['EUR', 'XOF', 'XAF'] as const;
