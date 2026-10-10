import 'server-only';
import {
  contributionsControllerIndicativeCurrency,
  followsControllerState,
  projectsControllerForMember,
  projectsControllerForPublic,
} from '@pitchorium/api-client';
import type { FollowState } from '@pitchorium/contracts';
import { cache } from 'react';
import type { FixedParity } from '@/features/projects';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { readResource } from '@/lib/resources/view';

/** The project as the reader may see it, read once per request (a draft for its team only). */
export const readProject = cache(async (slug: string) => {
  configureServerApi();
  const member = await getCurrentMember();
  return readResource({
    signedIn: member !== null,
    forMember: () => projectsControllerForMember(slug, { cache: 'no-store' }),
    forVisitor: () => projectsControllerForPublic(slug, { cache: 'no-store' }),
  });
});

/**
 * What a member reader adds to the page: their follow of the project, and the franc of their
 * country at its fixed parity (ADR 0130). Nothing breaks the page when the api cannot say.
 */
export async function readMemberContext(
  projectId: string,
): Promise<{ follow: FollowState | null; parity: FixedParity | null }> {
  configureServerApi();
  const [follow, currency] = await Promise.all([
    followsControllerState('project', projectId, { cache: 'no-store' }).catch(() => null),
    contributionsControllerIndicativeCurrency({ cache: 'no-store' }).catch(() => null),
  ]);
  return { follow, parity: currency?.fixedParity ?? null };
}
