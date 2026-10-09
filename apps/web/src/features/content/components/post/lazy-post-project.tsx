'use client';

import dynamic from 'next/dynamic';

/**
 * The project of a publication, read for a member only: loaded on demand so that a visitor's
 * page of a publication never carries the code that reads it (ADR 0094). Its own boundary
 * (`loading`): without it, `next/dynamic` gives none, and a card that comes into a virtualized
 * feed suspended the whole page while the code loaded (the page hidden, the focus lost).
 */
export const LazyPostProject = dynamic(
  () => import('./post-project').then((module) => module.PostProject),
  { loading: () => null },
);
