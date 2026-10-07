import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/**
 * Network events: payloads hold identifiers only (no note, no name); handlers read the rest
 * through the facades. Follow and block events have the acting member as aggregate,
 * connection request events the request.
 */
abstract class MemberEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'member';
}

abstract class RequestEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'connection_request';
}

export type FollowOrigin = 'manual' | 'connection';

export class FollowCreated extends MemberEvent<{
  targetType: string;
  targetId: string;
  origin: FollowOrigin;
}> {
  static readonly TYPE = 'network.follow.created.v1';
  readonly type = FollowCreated.TYPE;
  constructor(props: DomainEventProps<FollowCreated['payload']>) {
    super(props);
  }
}

export type FollowRemovalReason = 'unfollowed' | 'connection_removed' | 'blocked';

export class FollowRemoved extends MemberEvent<{
  targetType: string;
  targetId: string;
  reason: FollowRemovalReason;
}> {
  static readonly TYPE = 'network.follow.removed.v1';
  readonly type = FollowRemoved.TYPE;
  constructor(props: DomainEventProps<FollowRemoved['payload']>) {
    super(props);
  }
}

type RequestPayload = { requesterId: string; addresseeId: string };

export class ConnectionRequested extends RequestEvent<RequestPayload> {
  static readonly TYPE = 'network.connection.requested.v1';
  readonly type = ConnectionRequested.TYPE;
  constructor(props: DomainEventProps<ConnectionRequested['payload']>) {
    super(props);
  }
}

export class ConnectionAccepted extends RequestEvent<RequestPayload> {
  static readonly TYPE = 'network.connection.accepted.v1';
  readonly type = ConnectionAccepted.TYPE;
  constructor(props: DomainEventProps<ConnectionAccepted['payload']>) {
    super(props);
  }
}

export class ConnectionDeclined extends RequestEvent<RequestPayload> {
  static readonly TYPE = 'network.connection.declined.v1';
  readonly type = ConnectionDeclined.TYPE;
  constructor(props: DomainEventProps<ConnectionDeclined['payload']>) {
    super(props);
  }
}

export class ConnectionWithdrawn extends RequestEvent<RequestPayload> {
  static readonly TYPE = 'network.connection.withdrawn.v1';
  readonly type = ConnectionWithdrawn.TYPE;
  constructor(props: DomainEventProps<ConnectionWithdrawn['payload']>) {
    super(props);
  }
}

/** Aggregate: the member who removed the connection (or blocked the other one). */
export class ConnectionRemoved extends MemberEvent<{
  peerId: string;
  reason: 'removed' | 'blocked';
}> {
  static readonly TYPE = 'network.connection.removed.v1';
  readonly type = ConnectionRemoved.TYPE;
  constructor(props: DomainEventProps<ConnectionRemoved['payload']>) {
    super(props);
  }
}

export class BlockCreated extends MemberEvent<{ blockedId: string }> {
  static readonly TYPE = 'network.block.created.v1';
  readonly type = BlockCreated.TYPE;
  constructor(props: DomainEventProps<BlockCreated['payload']>) {
    super(props);
  }
}

export class BlockRemoved extends MemberEvent<{ blockedId: string }> {
  static readonly TYPE = 'network.block.removed.v1';
  readonly type = BlockRemoved.TYPE;
  constructor(props: DomainEventProps<BlockRemoved['payload']>) {
    super(props);
  }
}
