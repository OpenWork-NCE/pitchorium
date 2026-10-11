'use client';

import dynamic from 'next/dynamic';

/**
 * The islands of a member reader on this page, loaded on demand in one chunk: an island declared
 * apart is a sibling chunk of the member frame and of the other islands, which carries its own
 * copy of what they share (TanStack Query, the client of the api, the addresses; ADR 0094). A
 * visitor never loads them. The `import()` stays in each loader: Next.js preloads it from there.
 */
export const ContributeEntryIsland = dynamic(() =>
  import('./islands-code').then((module) => module.ContributeEntry),
);
export const MemberActionsIsland = dynamic(() =>
  import('./islands-code').then((module) => module.MemberActions),
);
