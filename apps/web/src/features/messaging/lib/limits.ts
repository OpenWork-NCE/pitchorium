/**
 * Limits of the contracts the messaging forms show (`packages/contracts/src/messaging.ts`),
 * copied: a constant of the contracts would bring Zod into the first load of the page
 * (limits.spec.ts keeps them equal).
 */
export const MESSAGING_LIMITS = {
  body: 8000,
  attachments: 5,
  attachmentText: 300,
  introductionNote: 1000,
  search: 80,
} as const;

/** Messages read at a time: the latest when a conversation opens, then older ones. */
export const THREAD_PAGE_SIZE = 50;
