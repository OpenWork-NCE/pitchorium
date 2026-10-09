import 'server-only';
import { profilesControllerForMember, profilesControllerForPublic } from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { readResource } from '@/lib/resources/view';

/** The profile of a member as the reader may see it, read once per request. */
export const readProfile = cache(async (handle: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => profilesControllerForMember(handle, { cache: 'no-store' }),
    forVisitor: () => profilesControllerForPublic(handle, { cache: 'no-store' }),
  });
});
