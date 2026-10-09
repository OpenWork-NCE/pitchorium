'use client';

import dynamic from 'next/dynamic';

/**
 * Actions of a member reader on the pages of a resource, loaded on demand: the same pages serve
 * visitors, who never download them (ADR 0094, ADR 0101). The member space imports the
 * components themselves.
 */
export const LazyRelationshipActions = dynamic(() =>
  import('./relationship-actions').then((module) => module.RelationshipActions),
);
export const LazyFollowButton = dynamic(() =>
  import('./follow-button').then((module) => module.FollowButton),
);
export const LazyMemberLists = dynamic(() =>
  import('./member-lists').then((module) => module.MemberLists),
);
