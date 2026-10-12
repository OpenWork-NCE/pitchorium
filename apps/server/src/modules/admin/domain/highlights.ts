import type { HighlightTargetType } from '@pitchorium/contracts';

export interface HighlightEntry {
  targetType: HighlightTargetType;
  targetId: string;
  featuredAt: Date | null;
  label: string | null;
}

/**
 * The order of display of the highlights: within each type, the latest featured first, as the
 * feed, the showcase and Discover show them; featuring one again puts it first. Every entry
 * gets its position in its type, from 1, and the list is sorted by type then position.
 */
export function highlightPositions<T extends HighlightEntry>(
  entries: readonly T[],
): (T & { position: number })[] {
  const order: readonly HighlightTargetType[] = ['post', 'project', 'profile'];
  return order.flatMap((type) =>
    entries
      .filter((entry) => entry.targetType === type)
      .sort((a, b) => (b.featuredAt?.getTime() ?? 0) - (a.featuredAt?.getTime() ?? 0))
      .map((entry, index) => ({ ...entry, position: index + 1 })),
  );
}
