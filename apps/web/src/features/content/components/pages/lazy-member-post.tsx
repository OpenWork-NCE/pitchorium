'use client';

import dynamic from 'next/dynamic';
import { PostSkeleton } from '../post-skeleton';

/**
 * A publication with the actions of a member, loaded on demand (never in a visitor's view). Its
 * own boundary (`loading`): a publication added to a list after the first render (the next page
 * of saved publications) would otherwise suspend the whole page while the code loads.
 */
export const LazyMemberPost = dynamic(
  () => import('./member-post').then((module) => module.MemberPost),
  { loading: () => <PostSkeleton /> },
);
