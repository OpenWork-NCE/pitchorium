import type { ConnectionState, RelationDegree, VisibilityLevel } from '@pitchorium/contracts';

/**
 * Degree of relation, computed up to the second degree only: a third degree would mean
 * exploring the connections of every connection (ADR 0028).
 */
export function degreeOf(input: {
  self: boolean;
  connected: boolean;
  mutualConnections: number;
}): RelationDegree {
  if (input.self) return 'self';
  if (input.connected) return 'first';
  return input.mutualConnections > 0 ? 'second' : 'out_of_network';
}

export function connectionStateOf(
  viewerId: string,
  connected: boolean,
  pending: { requesterId: string } | null,
): ConnectionState {
  if (connected) return 'connected';
  if (!pending) return 'none';
  return pending.requesterId === viewerId ? 'request_sent' : 'request_received';
}

export type ListAudience = 'owner' | 'member' | 'public';

/**
 * Visibility of a member's network lists (setting stored by profiles, ADR 0017): `public` lists
 * are also shown without an account, on a profile whose public page is enabled.
 */
export function canSeeNetworkLists(
  level: VisibilityLevel,
  audience: ListAudience,
  publicPageEnabled: boolean,
): boolean {
  switch (audience) {
    case 'owner':
      return true;
    case 'member':
      return level !== 'private';
    case 'public':
      return level === 'public' && publicPageEnabled;
  }
}
