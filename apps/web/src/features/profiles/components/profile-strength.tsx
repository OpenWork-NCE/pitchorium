'use client';

import type { ProfileStrength as Strength } from '@pitchorium/contracts';
import { lazy, Suspense } from 'react';
import { Card, Loading, Skeleton } from '@/components/ui';

/** The card loads after the page: it is its owner's only (ADR 0094). */
const ProfileStrengthCard = lazy(() =>
  import('./profile-strength-card').then((module) => ({ default: module.ProfileStrengthCard })),
);

/** Strength of the profile of its owner (ProfileStrengthCard), its card drawn while it loads. */
export function ProfileStrength({ strength }: { strength: Strength }) {
  return (
    <Suspense
      fallback={
        <Loading>
          <Card padding="sm" className="grid gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-2" />
            <Skeleton className="h-9" />
          </Card>
        </Loading>
      }
    >
      <ProfileStrengthCard strength={strength} />
    </Suspense>
  );
}
