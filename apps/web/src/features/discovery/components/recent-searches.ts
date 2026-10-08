'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'pitchorium.search.recent';
const MAX = 6;
const EMPTY: readonly string[] = [];
const listeners = new Set<() => void>();
let cache: { raw: string | null; list: readonly string[] } = { raw: null, list: EMPTY };

function read(): readonly string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cache.raw) {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cache = {
        raw,
        list: Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === 'string')
          : EMPTY,
      };
    }
    return cache.list;
  } catch {
    // Storage unavailable (private window, blocked site data): no recent searches.
    return EMPTY;
  }
}

function write(list: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Not kept: a convenience of this browser only.
  }
  for (const listener of listeners) listener();
}

/**
 * Last searches of this browser, most recent first: a convenience kept in local storage, never
 * sent anywhere (the search itself arrives with the search pages).
 */
export function useRecentSearches(): {
  recent: readonly string[];
  remember: (query: string) => void;
  clear: () => void;
} {
  const recent = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => EMPTY,
  );
  const remember = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    write([trimmed, ...read().filter((item) => item !== trimmed)].slice(0, MAX));
  }, []);
  const clear = useCallback(() => write([]), []);
  return { recent, remember, clear };
}
