'use client';

import dynamic from 'next/dynamic';

/** The activity with the actions of a member, loaded on demand (never in a visitor's view). */
export const LazyMemberActivity = dynamic(() => import('./member-activity'));
