import { describe, expect, it } from 'vitest';
import { imageGrid } from './image-grid';

describe('grid of the images of a publication', () => {
  it('adapts to the number of images', () => {
    expect(imageGrid(1)).toMatchObject({ grid: 'single', shown: 1, more: 0 });
    expect(imageGrid(2).cells.map((cell) => cell.ratio)).toEqual(['4/5', '4/5']);
    expect(imageGrid(3).cells.map((cell) => cell.span)).toEqual([2, 1, 1]);
    // The tall image stretches to the two squares beside it.
    expect(imageGrid(3).cells[0]?.ratio).toBe('auto');
    expect(imageGrid(4)).toMatchObject({ grid: 'four', shown: 4, more: 0 });
  });

  it('says how many more images there are from five on', () => {
    expect(imageGrid(5)).toMatchObject({ shown: 4, more: 1 });
    expect(imageGrid(9)).toMatchObject({ shown: 4, more: 5 });
  });

  it('draws nothing without image', () => {
    expect(imageGrid(0)).toMatchObject({ shown: 0, cells: [] });
  });
});
