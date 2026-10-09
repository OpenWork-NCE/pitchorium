import type { Relationship } from '@pitchorium/contracts';

/** What the reader does to their relationship with a member. */
export type RelationshipAction =
  | { kind: 'request'; requestId?: string }
  | { kind: 'withdraw' }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'remove' }
  | { kind: 'follow' }
  | { kind: 'unfollow' };

/** A count shown only when the lists are visible to the reader; never below zero. */
function shift(
  counts: Relationship['counts'],
  field: 'followers' | 'connections',
  by: number,
): Relationship['counts'] {
  return counts ? { ...counts, [field]: Math.max(0, counts[field] + by) } : null;
}

/**
 * The relationship as the api will answer it once the action succeeds (ADR 0112): shown at
 * once, given back if the api refuses. An accepted request connects and makes both members
 * follow each other (ADR 0028); removing a connection keeps the follows of the reader, which the
 * api then gives.
 */
export function afterAction(relationship: Relationship, action: RelationshipAction): Relationship {
  switch (action.kind) {
    case 'request':
      return {
        ...relationship,
        connection: 'request_sent',
        requestId: action.requestId ?? relationship.requestId,
      };
    case 'withdraw':
    case 'decline':
      return { ...relationship, connection: 'none', requestId: null };
    case 'accept':
      return {
        ...relationship,
        connection: 'connected',
        requestId: null,
        degree: 'first',
        following: true,
        followedBy: true,
        counts: shift(
          relationship.following ? relationship.counts : shift(relationship.counts, 'followers', 1),
          'connections',
          1,
        ),
      };
    case 'remove':
      return {
        ...relationship,
        connection: 'none',
        counts: shift(relationship.counts, 'connections', -1),
      };
    case 'follow':
      return relationship.following
        ? relationship
        : { ...relationship, following: true, counts: shift(relationship.counts, 'followers', 1) };
    case 'unfollow':
      return relationship.following
        ? {
            ...relationship,
            following: false,
            counts: shift(relationship.counts, 'followers', -1),
          }
        : relationship;
  }
}
