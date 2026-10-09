import type { ReactionSummary, ReactionType } from '@pitchorium/contracts';

/** The four professional reactions (§10.3), in the order of the picker. */
export const REACTIONS: readonly ReactionType[] = ['like', 'bravo', 'insightful', 'support'];

/**
 * The summary as it will be once the reader's reaction is `next` (null: taken back): shown at
 * once, before the api answers (ADR 0112); the answer of the api replaces it, a refusal puts the
 * previous summary back.
 */
export function withReaction(summary: ReactionSummary, next: ReactionType | null): ReactionSummary {
  const previous = summary.viewerReaction;
  if (previous === next) return summary;
  const counts = { ...summary.counts };
  let total = summary.total;
  if (previous) {
    counts[previous] = Math.max(0, counts[previous] - 1);
    total -= 1;
  }
  if (next) {
    counts[next] += 1;
    total += 1;
  }
  return { counts, total: Math.max(0, total), viewerReaction: next };
}

/** A click on the main button: J'aime, or taking back the reaction given. */
export function toggledReaction(current: ReactionType | null): ReactionType | null {
  return current === null ? 'like' : null;
}
