'use client';

import dynamic from 'next/dynamic';

/** A publication with the actions of a member, loaded on demand (never in a visitor's view). */
export const LazyMemberPost = dynamic(() =>
  import('./member-post').then((module) => module.MemberPost),
);
