import { describe, expect, it } from 'vitest';
import { transitionName } from './shared';

describe('transitionName', () => {
  it('derives a valid identifier from the resource and its place', () => {
    expect(transitionName('post', '0192f4a0-1', 0, '«r1»')).toBe('vt-post-0192f4a0-1-0--r1-');
    expect(transitionName('post', 'a', 0, '_r_1_')).not.toBe(
      transitionName('post', 'a', 0, '_r_2_'),
    );
  });
});
