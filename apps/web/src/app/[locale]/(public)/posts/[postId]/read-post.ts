import 'server-only';
import { postsControllerGet, postsControllerGetPublic } from '@pitchorium/api-client';
import { cache } from 'react';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { readResource } from '@/lib/resources/view';

/** A publication as the reader may see it, read once per request (ADR 0101). */
export const readPost = cache(async (postId: string) => {
  // Not an identifier of the api: absent, without asking it.
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null;
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => postsControllerGet(postId, { cache: 'no-store' }),
    forVisitor: () => postsControllerGetPublic(postId, { cache: 'no-store' }),
  });
});
