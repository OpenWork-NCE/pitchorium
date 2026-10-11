'use client';

import dynamic from 'next/dynamic';

/**
 * The language and the theme of the header of the localised 404 page, loaded after it: that
 * boundary is part of the first load of every page of a locale, which must not carry these
 * controls twice (FRONT 7, A2). Their place is kept meanwhile (two buttons of 44 px).
 */
export const LazyHeaderControls = dynamic(
  () => import('./header-controls').then((module) => module.HeaderControls),
  { ssr: false, loading: () => <span aria-hidden className="block h-11 w-24" /> },
);
