'use client';

import { useEffect } from 'react';

/**
 * Development only (ADR 0145): each view transition checks that no name is carried twice in the
 * document, and says so in the console. The production build drops it; the console guard of the
 * end-to-end tests installs the same check in every page.
 */
export function TransitionNamesWatch() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    void import('@/lib/view-transitions/check').then(
      ({ duplicateTransitionNames, watchTransitionNames }) =>
        // eslint-disable-next-line no-console -- a check of development, read in the console.
        watchTransitionNames((text) => console.error(text), duplicateTransitionNames),
    );
  }, []);
  return null;
}
