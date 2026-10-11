'use client';

import dynamic from 'next/dynamic';

/** The invitations of a member, read in the browser: never in a visitor's showcase. */
export const LazyProjectInvitations = dynamic(
  () => import('./project-invitations').then((module) => module.ProjectInvitations),
  { loading: () => null },
);

/** The answer to an invitation opened from its notification, loaded at the click. */
export const LazyProjectInvitationDialogContent = dynamic(
  () =>
    import('./project-invitation-dialog').then((module) => module.ProjectInvitationDialogContent),
  { ssr: false },
);
