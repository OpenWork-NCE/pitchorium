import type { ReactionType } from '@pitchorium/contracts';

export type ReactionChange = 'added' | 'changed' | 'removed' | 'unchanged';

/** One reaction per member and target, modifiable. */
export function reactionChange(
  previous: ReactionType | null,
  next: ReactionType | null,
): ReactionChange {
  if (previous === next) return 'unchanged';
  if (previous === null) return 'added';
  return next === null ? 'removed' : 'changed';
}
