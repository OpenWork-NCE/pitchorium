'use client';

import dynamic from 'next/dynamic';
import { FieldSkeleton } from '@/components/ui';

/** The form of an event, after the page: its controls and their validation are not in its first load. */
export const LazyEventForm = dynamic(
  () => import('./event-form').then((module) => module.EventForm),
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
