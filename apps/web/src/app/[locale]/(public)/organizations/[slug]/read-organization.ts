import 'server-only';
import {
  organizationsControllerForMember,
  organizationsControllerForPublic,
} from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { readResource } from '@/lib/resources/view';

/** The organisation as the reader may see it, read once per request. */
export const readOrganization = cache(async (slug: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => organizationsControllerForMember(slug, { cache: 'no-store' }),
    forVisitor: () => organizationsControllerForPublic(slug, { cache: 'no-store' }),
  });
});
