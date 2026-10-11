'use client';

import dynamic from 'next/dynamic';
import { FieldSkeleton } from '@/components/ui';

/** The form of a mission, after the page: its controls and validation are not in its first load. */
export const LazyMissionForm = dynamic(
  () => import('./mission-form').then((module) => module.MissionForm),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6" aria-busy="true">
        <FieldSkeleton />
        <FieldSkeleton />
        <FieldSkeleton />
      </div>
    ),
  },
);
