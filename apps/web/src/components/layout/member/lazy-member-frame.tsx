'use client';

import dynamic from 'next/dynamic';

/**
 * The client part of the member shell in its own chunk: a page that serves visitors and members
 * at one address (ADR 0101) keeps it out of the first load of a visitor, and a member gets it
 * with the server render of the page (ADR 0094).
 */
export const LazyMemberFrame = dynamic(() =>
  import('./member-frame').then((module) => module.MemberFrame),
);
