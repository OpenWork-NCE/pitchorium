'use client';

import dynamic from 'next/dynamic';

/**
 * TanStack Query and the URL state for a part of a public page that reads the api from the
 * browser, loaded on demand: a page rendered without that part (a visitor's view) never
 * downloads them (ADR 0094).
 */
export const ClientData = dynamic(() =>
  import('./client-data-providers').then((module) => module.ClientDataProviders),
);
