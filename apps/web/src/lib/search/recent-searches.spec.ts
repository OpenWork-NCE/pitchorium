// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearRecentSearches, useRecentSearches } from './recent-searches';

describe('useRecentSearches', () => {
  afterEach(() => localStorage.clear());

  it('keeps the last six searches of the device, most recent first, without duplicates', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => {
      for (const query of ['solaire', 'mentor', ' Sahel ', 'mentor', 'a', 'b', 'c', 'd']) {
        result.current.remember(query);
      }
    });
    expect(result.current.recent).toEqual(['d', 'c', 'b', 'a', 'mentor', 'Sahel']);
    act(() => result.current.remember('   '));
    expect(result.current.recent).toHaveLength(6);
  });

  it('forgets them at the sign-out and when the member clears them', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => result.current.remember('énergie'));
    act(() => clearRecentSearches());
    expect(result.current.recent).toEqual([]);
    expect(localStorage.getItem('pitchorium.search.recent')).toBeNull();
    act(() => result.current.remember('coopérative'));
    act(() => result.current.clear());
    expect(result.current.recent).toEqual([]);
  });
});
