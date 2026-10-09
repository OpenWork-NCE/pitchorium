/** Images of a publication shown in its grid: four, the last one saying how many more. */
export const GRID_MAX_SHOWN = 4;

/** How a grid of 1 to 9 images is drawn (docs/design/direction.md, ratios 4:5 to 16:9). */
export interface ImageGridLayout {
  /** Images drawn, in their order. */
  shown: number;
  /** Images not drawn, said on the last one (« +N »). */
  more: number;
  /** Class of the grid. */
  grid: 'single' | 'two' | 'three' | 'four';
  /** Ratio of each cell, the first one may span. */
  cells: { ratio: '4/3' | '1/1' | '4/5' | 'auto'; span: 1 | 2 }[];
}

/**
 * Layout of the images of a publication: one keeps its ratio (bounded between 4:5 and 16:9 by
 * the card), two side by side, three with the first one tall, four and more in a square grid of
 * four, the last cell saying « +N ».
 */
export function imageGrid(count: number): ImageGridLayout {
  if (count <= 1)
    return {
      shown: count,
      more: 0,
      grid: 'single',
      cells: count ? [{ ratio: 'auto', span: 1 }] : [],
    };
  if (count === 2) {
    return {
      shown: 2,
      more: 0,
      grid: 'two',
      cells: [
        { ratio: '4/5', span: 1 },
        { ratio: '4/5', span: 1 },
      ],
    };
  }
  if (count === 3) {
    return {
      shown: 3,
      more: 0,
      grid: 'three',
      // The tall image fills the height of the two squares beside it.
      cells: [
        { ratio: 'auto', span: 2 },
        { ratio: '1/1', span: 1 },
        { ratio: '1/1', span: 1 },
      ],
    };
  }
  return {
    shown: GRID_MAX_SHOWN,
    more: count - GRID_MAX_SHOWN,
    grid: 'four',
    cells: Array.from({ length: GRID_MAX_SHOWN }, () => ({
      ratio: '1/1' as const,
      span: 1 as const,
    })),
  };
}
