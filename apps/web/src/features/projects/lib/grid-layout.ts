/**
 * The layout of a list of project cards from its count (ADR 0161): nothing for none (the section
 * is not shown), one card featured across the width, two in two columns, a grid from three. A
 * grid never shows a row half filled with empty columns.
 */
export type GridLayout = 'none' | 'feature' | 'pair' | 'grid';

export function gridLayout(count: number): GridLayout {
  if (count <= 0) return 'none';
  if (count === 1) return 'feature';
  if (count === 2) return 'pair';
  return 'grid';
}
