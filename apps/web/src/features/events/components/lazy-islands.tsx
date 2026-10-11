'use client';

import dynamic from 'next/dynamic';

/**
 * The interactive parts of the page of an event, for a member only: the visitor's view carries
 * none of their code (ADR 0094). Their place is kept while they load.
 */
export const LazyRegistration = dynamic(
  () => import('./registration').then((module) => module.Registration),
  { loading: () => <span aria-hidden className="block h-11" /> },
);

export const LazyAttendees = dynamic(() =>
  import('./attendees').then((module) => module.Attendees),
);

export const LazyEventManage = dynamic(() =>
  import('./event-manage').then((module) => module.EventManage),
);
