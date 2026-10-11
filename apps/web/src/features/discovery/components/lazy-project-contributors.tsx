'use client';

import dynamic from 'next/dynamic';

/** « Contributeurs potentiels », loaded with its tab of the management of a project. */
export const LazyProjectContributors = dynamic(() =>
  import('./project-contributors').then((module) => module.ProjectContributors),
);
