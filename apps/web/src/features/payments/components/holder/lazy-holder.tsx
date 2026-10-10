'use client';

import dynamic from 'next/dynamic';

/*
 * The parts of the management of a project that come from the payments (§11.3), each loaded when
 * its tab opens (the panels of Radix Tabs mount when active), the banner after the page.
 */
export const LazyProjectContributions = dynamic(() =>
  import('./project-contributions').then((module) => module.ProjectContributions),
);
export const LazyProjectOffline = dynamic(() =>
  import('./project-offline').then((module) => module.ProjectOffline),
);
export const LazyProjectSupporters = dynamic(() =>
  import('./project-supporters').then((module) => module.ProjectSupporters),
);
export const LazyCollectionBanner = dynamic(
  () => import('./collection-banner').then((module) => module.CollectionBanner),
  { loading: () => null },
);
