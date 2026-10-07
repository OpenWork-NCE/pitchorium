import type { FollowRemovalReason } from './network-events';

/** Relations between two members at the time one blocks the other. */
export interface PairRelations {
  connected: boolean;
  /** Member follows between the two, in either direction. */
  follows: readonly { followerId: string; targetId: string }[];
  pendingRequestIds: readonly string[];
}

export interface BlockEffects {
  removeConnection: boolean;
  removedFollows: readonly { followerId: string; targetId: string; reason: FollowRemovalReason }[];
  cancelledRequestIds: readonly string[];
}

/**
 * Blocking removes every relation in both directions: connection, follows and pending
 * requests (ADR 0029). Nothing is restored by unblocking.
 */
export function blockEffects(relations: PairRelations): BlockEffects {
  return {
    removeConnection: relations.connected,
    removedFollows: relations.follows.map((follow) => ({ ...follow, reason: 'blocked' as const })),
    cancelledRequestIds: [...relations.pendingRequestIds],
  };
}
