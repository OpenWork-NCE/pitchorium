'use client';

import {
  getMemberNetworkControllerConnectionsQueryKey,
  memberNetworkControllerConnections,
} from '@pitchorium/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCurrentMember } from '@/features/identity';

/** Connections offered by a choice (introduce, share): the most recent ones (provisional). */
export const CONNECTIONS_SHOWN = 100;

/**
 * The connections of the member, for a choice among them (§10.4: introduce two of them, send a
 * publication to one): read once the choice opens.
 */
export function useMyConnections(enabled: boolean) {
  const handle = useCurrentMember().profile.handle;
  return useQuery({
    queryKey: getMemberNetworkControllerConnectionsQueryKey(handle, { limit: CONNECTIONS_SHOWN }),
    queryFn: async ({ signal }) =>
      (
        await memberNetworkControllerConnections(handle, { limit: CONNECTIONS_SHOWN }, { signal })
      ).items.map((item) => item.member),
    enabled,
  });
}
