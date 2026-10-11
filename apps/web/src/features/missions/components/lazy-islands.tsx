'use client';

import dynamic from 'next/dynamic';

/** What a member does on a mission, loaded for a member only (ADR 0094). */
export const LazyEngage = dynamic(() => import('./engage').then((module) => module.Engage), {
  loading: () => <span aria-hidden className="block h-11" />,
});

export const LazyAuthorPanel = dynamic(() =>
  import('./author-panel').then((module) => module.AuthorPanel),
);
