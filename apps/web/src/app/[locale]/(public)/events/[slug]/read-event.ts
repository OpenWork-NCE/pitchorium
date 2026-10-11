import 'server-only';
import { eventsControllerBySlug, eventsControllerForPublic } from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { readResource } from '@/lib/resources/view';

/** The event as the reader may see it, read once per request (a draft for its organizers only). */
export const readEvent = cache(async (slug: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => eventsControllerBySlug(slug, { cache: 'no-store' }),
    forVisitor: () => eventsControllerForPublic(slug, { cache: 'no-store' }),
  });
});
