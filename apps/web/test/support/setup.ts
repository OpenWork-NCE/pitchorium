import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/** matchMedia of jsdom: no query matches unless a test sets `reducedMotion`. */
export const media = { reducedMotion: false };

if (typeof window !== 'undefined') {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('prefers-reduced-motion: reduce') && media.reducedMotion,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  media.reducedMotion = false;
  // Testing Library unmounts automatically only with Vitest globals, which are off.
  if (typeof window !== 'undefined') cleanup();
});
