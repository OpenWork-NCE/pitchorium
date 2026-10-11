import { describe, expect, it } from 'vitest';
import { gridLayout } from './grid-layout';

describe('the layout of project cards from their count', () => {
  it('hides the section without project', () => {
    expect(gridLayout(0)).toBe('none');
  });

  it('features one card across the width, two in two columns, a grid from three', () => {
    expect(gridLayout(1)).toBe('feature');
    expect(gridLayout(2)).toBe('pair');
    expect(gridLayout(3)).toBe('grid');
    expect(gridLayout(7)).toBe('grid');
  });
});
