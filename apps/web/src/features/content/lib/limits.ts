/**
 * Limits of the publications, written here as the contracts set them so that the feed and its
 * chunks never load Zod with the contracts (ADR 0094); limits.spec.ts keeps them equal.
 */
export const LIMITS = {
  postText: 3000,
  commentText: 1250,
  images: 9,
  imageAlt: 1000,
  documentTitle: 200,
  viewsPerSignal: 50,
  newerCap: 20,
} as const;
