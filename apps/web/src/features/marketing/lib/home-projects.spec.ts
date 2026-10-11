import { describe, expect, it } from 'vitest';
import { homeProjects } from './home-projects';

const p = (id: string) => ({ id });

describe('the projects of the home page', () => {
  it('completes the editorial selection with the recent projects in funding, without duplicate', () => {
    expect(homeProjects([p('a')], [p('b'), p('a'), p('c'), p('d')])).toEqual([
      p('a'),
      p('b'),
      p('c'),
    ]);
  });

  it('keeps the selection first and never goes past three', () => {
    expect(homeProjects([p('a'), p('b'), p('c'), p('d')], [p('e')])).toEqual([
      p('a'),
      p('b'),
      p('c'),
    ]);
  });

  it('is empty when the api gives nothing: the section is hidden', () => {
    expect(homeProjects([], [])).toEqual([]);
  });
});
