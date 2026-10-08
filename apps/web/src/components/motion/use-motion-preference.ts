'use client';

import { useSyncExternalStore } from 'react';

interface NetworkInformation {
  saveData?: boolean;
}

const QUERIES = ['(prefers-reduced-motion: reduce)', '(prefers-reduced-data: reduce)'];

function prefersLessMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return QUERIES.some((query) => window.matchMedia(query).matches) || connection?.saveData === true;
}

function subscribe(onChange: () => void): () => void {
  const lists = QUERIES.map((query) => window.matchMedia(query));
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

/**
 * `reduced` when the visitor asks for less motion or less data (prefers-reduced-motion,
 * prefers-reduced-data, Save-Data): every primitive then shows its final state at once. The
 * server renders the final states too, so the first paint never waits for an animation.
 */
export function useMotionPreference(): 'full' | 'reduced' {
  return useSyncExternalStore(
    subscribe,
    () => (prefersLessMotion() ? 'reduced' : 'full'),
    () => 'full',
  );
}
