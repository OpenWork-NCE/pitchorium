/**
 * Keeps the reading place of a history when older messages arrive above it (ADR 0146): the
 * first row seen before the change stays at the same distance from the top of the view, so
 * nothing jumps. Pure: the rows are given by their key, their start and their size (measured, or
 * estimated by the virtualizer).
 */

export interface PlacedRow {
  key: string;
  start: number;
  size: number;
}

export interface Anchor {
  key: string;
  /** Distance from the top of the view to the top of the row (negative when cut above). */
  offset: number;
}

/** The first row still seen at this scroll position, or null for an empty list. */
export function captureAnchor(rows: readonly PlacedRow[], scrollTop: number): Anchor | null {
  const row = rows.find((candidate) => candidate.start + candidate.size > scrollTop) ?? rows.at(-1);
  return row ? { key: row.key, offset: row.start - scrollTop } : null;
}

/**
 * The scroll position that puts the anchor back at its place among the new rows; the previous
 * position when the anchor left the list.
 */
export function restoreAnchor(
  anchor: Anchor | null,
  rows: readonly PlacedRow[],
  previousScrollTop: number,
): number {
  if (!anchor) return previousScrollTop;
  const row = rows.find((candidate) => candidate.key === anchor.key);
  return row ? Math.max(0, row.start - anchor.offset) : previousScrollTop;
}

/** True when the view shows the end of the list, within a tolerance (a new message follows). */
export function isAtEnd(
  scrollTop: number,
  viewHeight: number,
  totalHeight: number,
  tolerance = 48,
): boolean {
  return totalHeight - (scrollTop + viewHeight) <= tolerance;
}
