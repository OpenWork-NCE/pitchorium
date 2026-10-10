/**
 * Limits of the projects, written here as the contracts set them so that the pages and their
 * chunks never load Zod with the contracts (ADR 0094); limits.spec.ts keeps them equal.
 */
export const PROJECT_LIMITS = {
  title: 120,
  summary: 300,
  description: 20_000,
  impactArea: 200,
  countries: 10,
  gallery: 20,
  documents: 10,
  imageAlt: 1000,
  tiersMin: 1,
  tiersMax: 5,
  tierDescription: 500,
  durationMin: 30,
  durationMax: 90,
  rewardTitle: 120,
  rewardDescription: 1000,
  teamFunction: 80,
  updateText: 5000,
  updateImages: 6,
  interestMessage: 2000,
  interestDocuments: 3,
} as const;
