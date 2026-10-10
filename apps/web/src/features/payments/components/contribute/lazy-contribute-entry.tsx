'use client';

import dynamic from 'next/dynamic';

/**
 * « Contribuer » on the page of a project, loaded on demand: a visitor's page never carries it
 * (ADR 0094, ADR 0101), and the page shows while it loads.
 */
export const LazyContributeEntry = dynamic(
  () => import('./contribute-entry').then((module) => module.ContributeEntry),
  { loading: () => null },
);
