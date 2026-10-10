'use client';

import dynamic from 'next/dynamic';

/**
 * The actions of a member on the page of a project, loaded on demand: a visitor's page never
 * carries them (ADR 0094, ADR 0101). Their own boundary keeps the page shown while they load.
 */
export const LazyMemberActions = dynamic(
  () => import('./member-actions').then((module) => module.MemberActions),
  { loading: () => null },
);
